"""
enhancements.py
---------------
Enhancement building blocks for the ROI-improvement iteration sweep.

Each block is an orthogonal design choice that can be toggled independently,
so that the iterate_roi.py driver can compose configurations by flag.

Design choices:
  - Ledoit-Wolf-style shrinkage on regime-conditional covariance
  - Michaud resampled mean-variance (parametric bootstrap)
  - Regime-specific risk aversion (gamma)
  - Posterior-entropy-driven tilt scaling
  - Cross-sectional momentum overlay
  - Volatility targeting
  - Kelly-fraction scaling
  - CVaR floor constraint (soft penalty)
  - Forward-looking smoother (one-step look-ahead-free "posterior predictive")
"""
from __future__ import annotations

import numpy as np
import pandas as pd


# --- 1. Ledoit-Wolf shrinkage ----------------------------------------------
def lw_shrink(cov: np.ndarray, target: str = "diagonal", alpha: float = 0.2) -> np.ndarray:
    """Shrink `cov` toward a simple target. target='diagonal' (avg variance on diag,
    zeros off-diag) or 'identity' (scaled identity)."""
    n = cov.shape[0]
    if target == "identity":
        T = (np.trace(cov) / n) * np.eye(n)
    else:
        T = np.diag(np.diag(cov))
    return (1 - alpha) * cov + alpha * T


# --- 2. Michaud resampled MV ------------------------------------------------
def michaud_resample(mu: np.ndarray, cov: np.ndarray, n_boot: int,
                      mv_fn, rng: np.random.Generator) -> np.ndarray:
    """Parametric bootstrap of N(mu,cov), solve mv_fn(mu_b, cov_b) each time,
    average weights. mv_fn must take (mu, cov) -> w."""
    ws = []
    n = mu.size
    for _ in range(n_boot):
        sample = rng.multivariate_normal(mu, cov, size=60)
        mu_b = sample.mean(axis=0)
        cov_b = np.cov(sample.T) + 1e-6 * np.eye(n)
        ws.append(mv_fn(mu_b, cov_b))
    return np.mean(ws, axis=0)


# --- 3. Posterior entropy ---------------------------------------------------
def posterior_entropy(post: np.ndarray) -> float:
    p = np.clip(post, 1e-12, 1.0)
    return -np.sum(p * np.log(p))


def entropy_confidence(post: np.ndarray, K: int) -> float:
    """1 when posterior is a point mass, 0 when uniform."""
    h = posterior_entropy(post)
    h_max = np.log(K)
    return max(0.0, 1.0 - h / h_max)


# --- 4. Momentum overlay ----------------------------------------------------
def momentum_ranks(returns: np.ndarray, lookback: int = 6) -> np.ndarray:
    """Returns a (N,) vector of cross-sectional momentum scores in [-1, 1]."""
    if returns.shape[0] < lookback:
        return np.zeros(returns.shape[1])
    cum = np.prod(1 + returns[-lookback:], axis=0) - 1
    ranks = cum.argsort().argsort()
    N = len(cum)
    if N <= 1:
        return np.zeros(N)
    scaled = 2 * (ranks / (N - 1)) - 1
    return scaled.astype(float)


def momentum_tilt(weights: np.ndarray, momentum_score: np.ndarray,
                  strength: float = 0.10, cap: float = 0.6) -> np.ndarray:
    w = weights + strength * momentum_score
    w = np.clip(w, 0.0, cap)
    if w.sum() > 0:
        w = w / w.sum()
    return w


# --- 5. Volatility targeting ------------------------------------------------
def vol_target_scale(port_vol_monthly: float, target_annual: float = 0.10,
                      floor: float = 0.3, ceil: float = 1.5) -> float:
    """Scale the portfolio exposure so annualised vol hits target. Residual
    into cash (proxied by Treasuries in the main universe)."""
    port_vol_annual = port_vol_monthly * np.sqrt(12)
    if port_vol_annual < 1e-6:
        return 1.0
    s = target_annual / port_vol_annual
    return float(np.clip(s, floor, ceil))


# --- 6. Kelly fraction scaling ---------------------------------------------
def kelly_scale(mu: float, sigma2: float, conf: float, cap: float = 1.0) -> float:
    if sigma2 <= 0:
        return 0.0
    k = mu / sigma2
    return float(np.clip(conf * k, 0.0, cap))


# --- 7. CVaR floor (soft penalty) ------------------------------------------
def cvar_penalty(weights: np.ndarray, cov: np.ndarray, mu: np.ndarray,
                 alpha: float = 0.05) -> float:
    """Rough Gaussian approximation to the (1 - alpha) CVaR of -wᵀr."""
    port_var = float(weights @ cov @ weights)
    port_mu = float(weights @ mu)
    sigma = np.sqrt(port_var + 1e-12)
    # Standard Normal inverse CDF via Beasley-Springer-Moro is unavailable without scipy.
    # Use the tail-expectation closed form: CVaR_alpha = -mu + sigma * phi(z_alpha) / alpha
    z = {0.01: 2.326, 0.05: 1.645, 0.10: 1.282}.get(alpha, 1.645)
    phi = (1 / np.sqrt(2 * np.pi)) * np.exp(-0.5 * z * z)
    cvar = -port_mu + sigma * (phi / alpha)
    return cvar


def cvar_project(weights: np.ndarray, cov: np.ndarray, mu: np.ndarray,
                 cap: float = 0.6, max_cvar: float = 0.12) -> np.ndarray:
    """Reduce concentration on high-vol assets if CVaR exceeds max_cvar.
    Shrink top-risk weights toward an equal-risk-contribution vector."""
    cvar = cvar_penalty(weights, cov, mu)
    if cvar <= max_cvar:
        return weights
    risk_contrib = weights * (cov @ weights)
    # Target proportional to inverse-risk
    inv = 1.0 / np.clip(np.sqrt(np.diag(cov)), 1e-6, None)
    target = inv / inv.sum()
    blend = min(1.0, (cvar - max_cvar) / max_cvar)
    w = (1 - blend) * weights + blend * target
    w = np.clip(w, 0.0, cap)
    if w.sum() > 0:
        w = w / w.sum()
    return w


# --- 8. Forward posterior-predictive smoother (look-ahead-free) -----------
def one_step_predictive(post: np.ndarray, P: np.ndarray) -> np.ndarray:
    """p(z_{t+1} | F_t) = p(z_t | F_t) P. Does not use future information."""
    return post @ P


# --- 9. Regime-specific gamma mapping --------------------------------------
DEFAULT_REGIME_GAMMA = {0: 4.0, 1: 6.0, 2: 10.0}  # expansion, contraction, stress
# More aggressive in expansion, more defensive in stress.

def posterior_weighted_gamma(post: np.ndarray,
                              regime_gamma=DEFAULT_REGIME_GAMMA) -> float:
    return float(sum(post[k] * regime_gamma[k] for k in range(len(post))))


# --- 10. Blend with Risk Parity --------------------------------------------
def blend_with_rp(w_ours: np.ndarray, cov: np.ndarray, alpha: float = 0.5,
                   cap: float = 0.6) -> np.ndarray:
    inv = 1.0 / np.clip(np.sqrt(np.diag(cov)), 1e-6, None)
    rp = inv / inv.sum()
    w = (1 - alpha) * w_ours + alpha * rp
    w = np.clip(w, 0.0, cap)
    if w.sum() > 0:
        w = w / w.sum()
    return w
