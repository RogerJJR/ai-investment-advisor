"""
baselines.py
------------
Benchmark asset allocation strategies for comparison against the
LLM-augmented regime-aware allocator.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def equal_weight(returns: pd.DataFrame, start: int = 36) -> pd.DataFrame:
    """1/N monthly."""
    T, N = returns.shape
    W = np.full((T, N), np.nan)
    W[start:] = 1.0 / N
    return pd.DataFrame(W, index=returns.index,
                        columns=[f"w_{j}" for j in range(N)])


def sixty_forty(returns: pd.DataFrame,
                equity_idx=(0, 1, 2, 6),  # USEQ, INTLEQ, EMEQ, REIT -> "equity-like"
                bond_idx=(3, 4),           # TREAS, CORP
                equity_weight: float = 0.60,
                start: int = 36) -> pd.DataFrame:
    T, N = returns.shape
    W = np.full((T, N), np.nan)
    w = np.zeros(N)
    for i in equity_idx:
        w[i] = equity_weight / len(equity_idx)
    for i in bond_idx:
        w[i] = (1 - equity_weight) / len(bond_idx)
    W[start:] = w
    return pd.DataFrame(W, index=returns.index,
                        columns=[f"w_{j}" for j in range(N)])


def risk_parity(returns: pd.DataFrame, window: int = 36, start: int = 36) -> pd.DataFrame:
    """Inverse-volatility weights estimated on a rolling window."""
    T, N = returns.shape
    W = np.full((T, N), np.nan)
    R = returns.values
    for t in range(start, T):
        sd = R[t - window:t].std(axis=0)
        inv = 1.0 / np.clip(sd, 1e-6, None)
        w = inv / inv.sum()
        W[t] = w
    return pd.DataFrame(W, index=returns.index,
                        columns=[f"w_{j}" for j in range(N)])


def rolling_mean_variance(
    returns: pd.DataFrame,
    window: int = 36,
    risk_aversion: float = 5.0,
    long_only: bool = True,
    max_weight: float = 0.60,
    start: int = 36,
) -> pd.DataFrame:
    """Rolling unconditional MV (no regime information, no LLM)."""
    from .allocator import _simplex_cap_project
    T, N = returns.shape
    W = np.full((T, N), np.nan)
    R = returns.values
    for t in range(start, T):
        R_win = R[t - window:t]
        mu = R_win.mean(axis=0)
        cov = np.cov(R_win.T) + 1e-6 * np.eye(N)
        try:
            w_uc = np.linalg.solve(cov, mu / max(risk_aversion, 1e-6))
        except np.linalg.LinAlgError:
            w_uc = np.ones(N) / N
        if w_uc.sum() != 0:
            w_uc = w_uc / w_uc.sum()
        if long_only:
            w = _simplex_cap_project(w_uc, max_weight)
        else:
            w = w_uc
        W[t] = w
    return pd.DataFrame(W, index=returns.index,
                        columns=[f"w_{j}" for j in range(N)])
