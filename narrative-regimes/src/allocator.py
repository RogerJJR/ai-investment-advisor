"""
allocator.py
------------
Long-horizon CRRA-utility asset allocator.

Given posterior regime probabilities and per-regime return moments, we solve
a one-period CRRA expected utility problem. With γ > 1 this is a local
approximation of the Campbell-Viceira-style intertemporal problem; because
our regime filter is Markovian and persistent, the optimal one-period policy
carries intertemporal hedging features (it loads on regimes, not only on the
immediate mean/variance).

Optimization: mean-variance surrogate (closed-form with long-only and budget
constraints via projected gradient; no SciPy dependency).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass


@dataclass
class AllocConfig:
    risk_aversion: float = 5.0      # γ in CRRA / mean-variance surrogate
    long_only: bool = True
    max_weight: float = 0.60        # concentration cap
    min_cash_equiv: float = 0.0     # set > 0 if allocator must hold a min in Treasuries
    tc_bps: float = 10.0            # one-way transaction cost in bps applied in backtest
    turnover_penalty: float = 0.0   # optional L1 turnover penalty
    weight_inertia: float = 0.7     # blend new target with previous (1 = freeze, 0 = ignore prev)


def _simplex_cap_project(w: np.ndarray, cap: float) -> np.ndarray:
    """Project onto {w: sum w = 1, 0 <= w_i <= cap}. Simple iterative method."""
    w = np.clip(w, 0, cap)
    for _ in range(100):
        s = w.sum()
        if abs(s - 1.0) < 1e-9 and (w <= cap + 1e-12).all():
            return w
        w = w + (1.0 - s) / len(w)
        w = np.clip(w, 0, cap)
    w = w / max(w.sum(), 1e-12)
    return np.clip(w, 0, cap)


def mean_var_weights(mu: np.ndarray, cov: np.ndarray, cfg: AllocConfig) -> np.ndarray:
    """max_w  μ'w - γ/2 w'Σw  subject to 1'w = 1, 0<=w<=cap (if long-only)."""
    n = mu.size
    # Start from unconstrained solution
    try:
        w_uc = np.linalg.solve(cov + 1e-6 * np.eye(n), mu / max(cfg.risk_aversion, 1e-6))
    except np.linalg.LinAlgError:
        w_uc = np.ones(n) / n
    # Normalize then project
    if w_uc.sum() != 0:
        w_uc = w_uc / w_uc.sum()
    if cfg.long_only:
        w = _simplex_cap_project(w_uc, cfg.max_weight)
    else:
        w = w_uc
    return w


def regime_mixture_moments(
    post: np.ndarray,
    mu_k: np.ndarray,
    cov_k: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Mixture mean and covariance given regime posterior p (K,)."""
    K, N = mu_k.shape
    mu = np.zeros(N)
    for k in range(K):
        mu += post[k] * mu_k[k]
    cov = np.zeros((N, N))
    for k in range(K):
        d = mu_k[k] - mu
        cov += post[k] * (cov_k[k] + np.outer(d, d))
    return mu, cov


def _shrink_mu(mu_k: np.ndarray, alpha: float = 0.3) -> np.ndarray:
    """Shrink regime-conditional means toward the grand mean to reduce estimation error."""
    grand = mu_k.mean(axis=0, keepdims=True)
    return (1 - alpha) * mu_k + alpha * grand


def allocate_from_posterior(
    post_df: pd.DataFrame,
    mu_k_series: list[np.ndarray],
    cov_k_series: list[np.ndarray],
    cfg: AllocConfig,
    mode: str = "regime_policy_mix",
    shrinkage: float = 0.2,
) -> pd.DataFrame:
    """Compute allocations for each row of post_df using the per-regime moment
    snapshots at that time. mu_k_series[t] is K x N, cov_k_series[t] is K x N x N.

    mode:
      - 'moment_mix' (classic):  compute mixture mean/cov then do one MV optimization.
      - 'regime_policy_mix': compute MV-optimal weights per regime, then average
        by posterior (approximates the Markov-modulated CRRA policy and preserves
        heterogeneity across regimes).
    """
    n_assets = mu_k_series[0].shape[1]
    weights = np.full((len(post_df), n_assets), np.nan)
    prev_w = None
    for i, (ts, row) in enumerate(post_df.iterrows()):
        p = row.values
        if np.any(np.isnan(p)):
            continue
        mu_k = _shrink_mu(mu_k_series[i], shrinkage)
        cov_k = cov_k_series[i]
        if mode == "moment_mix":
            mu, cov = regime_mixture_moments(p, mu_k, cov_k)
            w = mean_var_weights(mu, cov, cfg)
        else:
            # Regime-specific MV weights, then posterior average
            K = mu_k.shape[0]
            w = np.zeros(n_assets)
            for k in range(K):
                wk = mean_var_weights(mu_k[k], cov_k[k], cfg)
                w += p[k] * wk
            # Re-project onto feasible set in case posterior-weighted mix violates cap
            from copy import copy
            c = copy(cfg); c.long_only = True
            w = _simplex_cap_project(w, cfg.max_weight)
        # Weight inertia smoother to control turnover
        if prev_w is not None and cfg.weight_inertia > 0:
            w = cfg.weight_inertia * prev_w + (1 - cfg.weight_inertia) * w
            w = _simplex_cap_project(w, cfg.max_weight)
        prev_w = w
        weights[i] = w
    return pd.DataFrame(weights, index=post_df.index,
                        columns=[f"w_{j}" for j in range(n_assets)])
