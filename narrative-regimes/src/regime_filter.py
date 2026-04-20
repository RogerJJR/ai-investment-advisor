"""
regime_filter.py
----------------
Online Bayesian regime filter that fuses (i) a rolling estimate of the
regime-conditional return distribution with (ii) exogenous narrative
signals (our proxy for LLM-distilled news). Returns posterior regime
probabilities at each t, conditional only on information available
strictly before t (i.e., no look-ahead), plus the per-time snapshots of
regime-conditional mu_k and cov_k used by the allocator.

Author: Roger Chuang
License: MIT
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass


def _logsumexp(x: np.ndarray) -> float:
    m = np.max(x)
    return m + np.log(np.sum(np.exp(x - m)))


def _normal_loglik(x: np.ndarray, mu: np.ndarray, cov: np.ndarray) -> float:
    """log N(x | mu, cov) without SciPy."""
    n = x.size
    d = x - mu
    eps = 1e-8 * np.trace(cov) / n
    L = np.linalg.cholesky(cov + eps * np.eye(n))
    z = np.linalg.solve(L, d)
    ld = 2.0 * np.sum(np.log(np.diag(L)))
    return -0.5 * (n * np.log(2 * np.pi) + ld + z @ z)


@dataclass
class FilterConfig:
    n_regimes: int = 3
    prior_lookback: int = 36
    narrative_weight: float = 1.0
    signal_prior_strength: float = 0.05
    P_init: np.ndarray | None = None
    use_narrative: bool = True


@dataclass
class FilterResult:
    posterior: pd.DataFrame      # T x K
    mu_k_hist: list              # length T, each K x N (NaN before warmup)
    cov_k_hist: list             # length T, each K x N x N
    P_hist: list                 # length T, each K x K


def run_filter(
    returns: pd.DataFrame,
    narratives: pd.DataFrame,
    config: FilterConfig | None = None,
) -> FilterResult:
    cfg = config or FilterConfig()
    K = cfg.n_regimes
    T, N = returns.shape
    R = returns.values
    S = narratives.values

    if cfg.P_init is None:
        P = 0.8 * np.eye(K) + 0.2 / K * np.ones((K, K))
    else:
        P = cfg.P_init.copy()

    init_labels = np.argmax(S[: cfg.prior_lookback], axis=1)
    mu_k = np.zeros((K, N))
    cov_k = np.zeros((K, N, N))
    base_cov = np.cov(R[: cfg.prior_lookback].T) + 1e-6 * np.eye(N)
    for k in range(K):
        mask = init_labels == k
        if mask.sum() >= 5:
            mu_k[k] = R[: cfg.prior_lookback][mask].mean(axis=0)
            c = np.cov(R[: cfg.prior_lookback][mask].T)
            cov_k[k] = c if c.ndim == 2 else base_cov.copy()
        else:
            mu_k[k] = R[: cfg.prior_lookback].mean(axis=0)
            cov_k[k] = base_cov.copy()

    sum_w = np.ones(K) * 1e-3
    sum_wx = np.zeros((K, N))
    sum_wxx = np.zeros((K, N, N))
    for k in range(K):
        mask = init_labels == k
        for x in R[: cfg.prior_lookback][mask]:
            sum_w[k] += 1.0
            sum_wx[k] += x
            sum_wxx[k] += np.outer(x, x)

    eigval, eigvec = np.linalg.eig(P.T)
    idx = np.argmin(np.abs(eigval - 1.0))
    pi0 = np.real(eigvec[:, idx]); pi0 = pi0 / pi0.sum()
    prev_post = pi0.copy()

    posteriors = np.full((T, K), np.nan)
    mu_k_hist = [np.full_like(mu_k, np.nan) for _ in range(T)]
    cov_k_hist = [np.full_like(cov_k, np.nan) for _ in range(T)]
    P_hist = [np.full_like(P, np.nan) for _ in range(T)]

    for t in range(cfg.prior_lookback, T):
        prior = prev_post @ P
        x = R[t]
        s = S[t]

        # Snapshot mu_k, cov_k, P BEFORE updating with t's observation
        mu_k_hist[t] = mu_k.copy()
        cov_k_hist[t] = cov_k.copy()
        P_hist[t] = P.copy()

        log_ll_r = np.array([_normal_loglik(x, mu_k[k], cov_k[k]) for k in range(K)])

        if cfg.use_narrative:
            beta = cfg.narrative_weight
            log_ll_s = np.array([
                -0.5 * beta * np.sum((s - np.eye(K)[k]) ** 2)
                for k in range(K)
            ])
        else:
            log_ll_s = np.zeros(K)

        log_post = np.log(prior + 1e-12) + log_ll_r + log_ll_s
        log_post -= _logsumexp(log_post)
        post = np.exp(log_post)
        posteriors[t] = post

        for k in range(K):
            w = post[k]
            sum_w[k] += w
            sum_wx[k] += w * x
            sum_wxx[k] += w * np.outer(x, x)
            mu_k[k] = sum_wx[k] / sum_w[k]
            m = mu_k[k]
            cov_raw = sum_wxx[k] / sum_w[k] - np.outer(m, m)
            cov_k[k] = 0.5 * (cov_raw + cov_raw.T) + 1e-6 * np.eye(N)

        lam = cfg.signal_prior_strength
        out = np.outer(prev_post, post)
        out = out / np.clip(out.sum(axis=1, keepdims=True), 1e-12, None)
        P = (1 - lam) * P + lam * out

        prev_post = post

    cols = [f"post_{k}" for k in range(K)]
    return FilterResult(
        posterior=pd.DataFrame(posteriors, index=returns.index, columns=cols),
        mu_k_hist=mu_k_hist,
        cov_k_hist=cov_k_hist,
        P_hist=P_hist,
    )
