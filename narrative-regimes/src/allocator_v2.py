"""
allocator_v2.py
---------------
Enhanced, flag-driven allocator that composes the enhancements in
enhancements.py to support the 30-iteration ROI-improvement sweep.

Usage:

    cfg = AllocConfigV2(
        risk_aversion=5.0,
        long_only=True,
        max_weight=0.60,
        min_cash_equiv=0.05,
        use_lw_shrinkage=True,
        lw_alpha=0.2,
        use_regime_gamma=True,
        use_entropy_conf=True,
        use_momentum=True,
        use_vol_target=True,
        use_kelly=False,
        use_cvar=True,
        use_rp_blend=False,
        rp_blend_alpha=0.3,
        use_michaud=False,
        weight_inertia=0.7,
    )
    W = allocate_v2(fres, rets_so_far, cfg)
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass

from .enhancements import (
    lw_shrink, michaud_resample, entropy_confidence, momentum_ranks,
    momentum_tilt, vol_target_scale, kelly_scale, cvar_project,
    posterior_weighted_gamma, blend_with_rp,
)
from .allocator import (
    mean_var_weights, regime_mixture_moments, _shrink_mu, _simplex_cap_project,
)


@dataclass
class AllocConfigV2:
    # Core (inherited)
    risk_aversion: float = 5.0
    long_only: bool = True
    max_weight: float = 0.60
    min_cash_equiv: float = 0.0
    tc_bps: float = 10.0
    mu_shrinkage: float = 0.2
    weight_inertia: float = 0.7
    # Toggles
    use_lw_shrinkage: bool = False
    lw_alpha: float = 0.2
    use_regime_gamma: bool = False
    use_entropy_conf: bool = False
    entropy_floor: float = 0.4   # if below, pull toward prior baseline
    use_momentum: bool = False
    momentum_strength: float = 0.08
    use_vol_target: bool = False
    vol_target_annual: float = 0.10
    use_kelly: bool = False
    kelly_cap: float = 1.0
    use_cvar: bool = False
    cvar_max: float = 0.14
    use_rp_blend: bool = False
    rp_blend_alpha: float = 0.3
    use_michaud: bool = False
    michaud_n_boot: int = 50
    rebalance_threshold: float = 0.0  # skip rebalance if max |w - w_prev| < this


def _mv_fn_factory(gamma: float, cap: float, long_only: bool):
    def mv(mu, cov):
        from .allocator import AllocConfig
        c = AllocConfig(risk_aversion=gamma, long_only=long_only, max_weight=cap)
        return mean_var_weights(mu, cov, c)
    return mv


def allocate_v2(fres, returns_df, cfg: AllocConfigV2,
                prior_baseline=None, seed: int = 0) -> pd.DataFrame:
    """Main allocator with all enhancements toggleable.
    fres: FilterResult (has .posterior, .mu_k_hist, .cov_k_hist, .P_hist)
    returns_df: full historical returns DataFrame (used for momentum overlay)
    prior_baseline: optional (N,) baseline portfolio (e.g., 60/40) used when
        confidence is low.
    """
    rng = np.random.default_rng(seed)
    post_df = fres.posterior
    T, K = post_df.shape
    N = returns_df.shape[1]
    if prior_baseline is None:
        prior_baseline = np.ones(N) / N

    R = returns_df.values
    weights = np.full((T, N), np.nan)
    prev_w = None

    for i in range(T):
        p = post_df.values[i]
        if np.any(np.isnan(p)):
            continue

        mu_k = _shrink_mu(fres.mu_k_hist[i], cfg.mu_shrinkage)
        cov_k = fres.cov_k_hist[i].copy()
        if cfg.use_lw_shrinkage:
            for k in range(K):
                cov_k[k] = lw_shrink(cov_k[k], "diagonal", cfg.lw_alpha)

        gamma_t = (posterior_weighted_gamma(p) if cfg.use_regime_gamma
                   else cfg.risk_aversion)

        # Per-regime MV weights
        mv_fn = _mv_fn_factory(gamma_t, cfg.max_weight, cfg.long_only)
        w_per_regime = np.zeros((K, N))
        for k in range(K):
            if cfg.use_michaud:
                w_per_regime[k] = michaud_resample(mu_k[k], cov_k[k],
                                                    cfg.michaud_n_boot, mv_fn, rng)
            else:
                w_per_regime[k] = mv_fn(mu_k[k], cov_k[k])

        # Posterior mix
        w = np.zeros(N)
        for k in range(K):
            w += p[k] * w_per_regime[k]

        # Entropy-confidence blending (low conf -> closer to baseline)
        if cfg.use_entropy_conf:
            conf = entropy_confidence(p, K)
            if conf < cfg.entropy_floor:
                blend = (cfg.entropy_floor - conf) / cfg.entropy_floor
                w = (1 - blend) * w + blend * prior_baseline

        # Momentum overlay
        if cfg.use_momentum and i >= 6:
            mom = momentum_ranks(R[max(0, i-12):i], lookback=6)
            w = momentum_tilt(w, mom, strength=cfg.momentum_strength, cap=cfg.max_weight)

        # Vol targeting: scale risk exposure, residual to Treasuries (index 3)
        if cfg.use_vol_target:
            # Use posterior-mixture cov to estimate current portfolio vol
            _, mix_cov = regime_mixture_moments(p, mu_k, cov_k)
            port_vol = np.sqrt(max(1e-12, w @ mix_cov @ w))
            s = vol_target_scale(port_vol, cfg.vol_target_annual)
            if s < 1.0:
                shortage = 1.0 - s
                w = s * w
                w[3] += shortage  # dump excess into Treasuries
            # If s>1 we don't lever up (long-only constraint).

        # Kelly-fraction scaling: scale *tilt* from baseline by Kelly-like factor
        if cfg.use_kelly:
            conf = entropy_confidence(p, K)
            mix_mu, mix_cov = regime_mixture_moments(p, mu_k, cov_k)
            port_mu = float(w @ mix_mu)
            port_var = float(w @ mix_cov @ w)
            k_scale = kelly_scale(port_mu, port_var, conf, cap=cfg.kelly_cap)
            w_base = prior_baseline
            w = (1 - k_scale) * w_base + k_scale * w

        # CVaR projection
        if cfg.use_cvar:
            mix_mu, mix_cov = regime_mixture_moments(p, mu_k, cov_k)
            w = cvar_project(w, mix_cov, mix_mu, cap=cfg.max_weight,
                             max_cvar=cfg.cvar_max)

        # Risk-parity blend
        if cfg.use_rp_blend:
            _, mix_cov = regime_mixture_moments(p, mu_k, cov_k)
            w = blend_with_rp(w, mix_cov, alpha=cfg.rp_blend_alpha,
                              cap=cfg.max_weight)

        # Min-cash-equiv floor on Treasuries (index 3)
        if cfg.min_cash_equiv > 0:
            if w[3] < cfg.min_cash_equiv:
                deficit = cfg.min_cash_equiv - w[3]
                # scale others down proportionally
                other = w.copy(); other[3] = 0
                if other.sum() > 0:
                    w = other * (1 - cfg.min_cash_equiv) / other.sum()
                    w[3] = cfg.min_cash_equiv
            w = _simplex_cap_project(w, cfg.max_weight)

        # Weight-inertia smoother
        if prev_w is not None and cfg.weight_inertia > 0:
            w_new = cfg.weight_inertia * prev_w + (1 - cfg.weight_inertia) * w
            if cfg.rebalance_threshold > 0:
                if np.max(np.abs(w_new - prev_w)) < cfg.rebalance_threshold:
                    w_new = prev_w
            w = _simplex_cap_project(w_new, cfg.max_weight)

        prev_w = w
        weights[i] = w

    return pd.DataFrame(weights, index=post_df.index,
                        columns=[f"w_{j}" for j in range(N)])
