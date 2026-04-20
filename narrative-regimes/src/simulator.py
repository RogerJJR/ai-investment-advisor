"""
simulator.py
------------
Synthetic data generator for the Narrative Regimes study.

Generates a regime-switching multi-asset world plus noisy "LLM narrative"
signals with configurable signal-to-noise ratio, allowing a controlled
evaluation of LLM-augmented long-horizon asset allocation without the
look-ahead bias contamination that plagues empirical studies of LLMs
trained on historical corpora.

Author: Roger Chuang
License: MIT
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Tuple


# ---------------------------------------------------------------------------
# Regime configuration for a 7-asset long-horizon universe.
# Assets: US Equity, Intl Equity, EM Equity, Treasuries, Corp Bonds,
#         Commodities, REITs.
# Three regimes: Expansion (E), Contraction (C), Stress (S).
# Monthly frequency.
# ---------------------------------------------------------------------------

ASSET_NAMES = [
    "USEQ", "INTLEQ", "EMEQ", "TREAS", "CORP", "COMM", "REIT",
]
REGIME_NAMES = ["Expansion", "Contraction", "Stress"]


@dataclass
class RegimeSpec:
    """Mean vector and covariance matrix for one regime (monthly, decimal)."""
    mu: np.ndarray   # shape (n_assets,)
    cov: np.ndarray  # shape (n_assets, n_assets)


def _corr_to_cov(corr: np.ndarray, vols: np.ndarray) -> np.ndarray:
    D = np.diag(vols)
    return D @ corr @ D


def default_regime_specs() -> list[RegimeSpec]:
    # Annualized figures, converted to monthly.
    # Expansion: equities thrive, bonds muted, commodities ok.
    mu_E_ann = np.array([0.10, 0.085, 0.12, 0.025, 0.045, 0.05, 0.09])
    vol_E_ann = np.array([0.14, 0.16, 0.22, 0.05, 0.07, 0.18, 0.16])
    corr_E = np.array([
        [1.00, 0.78, 0.65, -0.10, 0.25, 0.20, 0.72],
        [0.78, 1.00, 0.70, -0.05, 0.30, 0.25, 0.60],
        [0.65, 0.70, 1.00, -0.02, 0.35, 0.35, 0.55],
        [-0.10, -0.05, -0.02, 1.00, 0.55, -0.05, 0.05],
        [0.25, 0.30, 0.35, 0.55, 1.00, 0.10, 0.30],
        [0.20, 0.25, 0.35, -0.05, 0.10, 1.00, 0.25],
        [0.72, 0.60, 0.55, 0.05, 0.30, 0.25, 1.00],
    ])

    # Contraction: equities soft, Treasuries rally (flight to quality), commodities weak.
    mu_C_ann = np.array([0.00, -0.01, -0.03, 0.055, 0.040, -0.02, -0.02])
    vol_C_ann = np.array([0.20, 0.22, 0.28, 0.06, 0.09, 0.22, 0.22])
    corr_C = np.array([
        [1.00, 0.82, 0.72, -0.35, 0.10, 0.35, 0.80],
        [0.82, 1.00, 0.78, -0.30, 0.15, 0.40, 0.70],
        [0.72, 0.78, 1.00, -0.25, 0.20, 0.45, 0.62],
        [-0.35, -0.30, -0.25, 1.00, 0.60, -0.25, -0.15],
        [0.10, 0.15, 0.20, 0.60, 1.00, -0.05, 0.15],
        [0.35, 0.40, 0.45, -0.25, -0.05, 1.00, 0.35],
        [0.80, 0.70, 0.62, -0.15, 0.15, 0.35, 1.00],
    ])

    # Stress: everything correlates to 1 except Treasuries; commodities spike vol.
    mu_S_ann = np.array([-0.18, -0.22, -0.30, 0.08, -0.05, 0.00, -0.25])
    vol_S_ann = np.array([0.32, 0.36, 0.45, 0.08, 0.16, 0.35, 0.38])
    corr_S = np.array([
        [1.00, 0.90, 0.85, -0.50, 0.35, 0.55, 0.88],
        [0.90, 1.00, 0.88, -0.45, 0.40, 0.55, 0.80],
        [0.85, 0.88, 1.00, -0.40, 0.45, 0.60, 0.75],
        [-0.50, -0.45, -0.40, 1.00, 0.30, -0.30, -0.35],
        [0.35, 0.40, 0.45, 0.30, 1.00, 0.25, 0.40],
        [0.55, 0.55, 0.60, -0.30, 0.25, 1.00, 0.50],
        [0.88, 0.80, 0.75, -0.35, 0.40, 0.50, 1.00],
    ])

    def monthly(mu_ann, vol_ann, corr):
        mu_m = mu_ann / 12.0
        vol_m = vol_ann / np.sqrt(12.0)
        cov_m = _corr_to_cov(corr, vol_m)
        return RegimeSpec(mu=mu_m, cov=cov_m)

    return [
        monthly(mu_E_ann, vol_E_ann, corr_E),
        monthly(mu_C_ann, vol_C_ann, corr_C),
        monthly(mu_S_ann, vol_S_ann, corr_S),
    ]


# Default transition matrix (monthly). Expansion persists most, stress rarely.
DEFAULT_P = np.array([
    [0.95, 0.04, 0.01],
    [0.12, 0.82, 0.06],
    [0.05, 0.35, 0.60],
])


def _nearest_psd(cov: np.ndarray) -> np.ndarray:
    w, V = np.linalg.eigh((cov + cov.T) / 2)
    w = np.clip(w, a_min=1e-10, a_max=None)
    return (V * w) @ V.T


def simulate_world(
    T: int = 360,
    P: np.ndarray = DEFAULT_P,
    specs: list[RegimeSpec] | None = None,
    seed: int = 0,
) -> Tuple[pd.DataFrame, np.ndarray]:
    """Return (returns_df [T x n_assets], regime_seq [T])."""
    rng = np.random.default_rng(seed)
    specs = specs or default_regime_specs()
    n_assets = len(ASSET_NAMES)

    # Stationary distribution for initial state
    eigval, eigvec = np.linalg.eig(P.T)
    idx = np.argmin(np.abs(eigval - 1.0))
    pi = np.real(eigvec[:, idx])
    pi = pi / pi.sum()

    regimes = np.empty(T, dtype=int)
    state = rng.choice(3, p=pi)
    returns = np.empty((T, n_assets))
    for t in range(T):
        regimes[t] = state
        spec = specs[state]
        cov_psd = _nearest_psd(spec.cov)
        returns[t] = rng.multivariate_normal(spec.mu, cov_psd)
        state = rng.choice(3, p=P[state])

    idx = pd.date_range("2000-01-31", periods=T, freq="ME")
    df = pd.DataFrame(returns, index=idx, columns=ASSET_NAMES)
    return df, regimes


def simulate_narrative_signal(
    regimes: np.ndarray,
    snr: float = 1.0,
    seed: int = 1,
) -> pd.DataFrame:
    """Generate noisy LLM-distilled narrative signals s_t in R^3 (logits) such that
    the argmax of E[s|regime] identifies the true regime, and the marginal
    posterior collapses to the uniform prior as snr -> 0.

    The narrative signal is a vector of three soft votes (expansion, contraction,
    stress). Under snr=1 each vote is centered at 1.0 for the true regime and
    0 for others, plus iid Gaussian noise with std 1/snr.

    Returns a DataFrame with three columns (Expansion, Contraction, Stress).
    """
    rng = np.random.default_rng(seed)
    T = len(regimes)
    K = 3
    s = np.zeros((T, K))
    for t in range(T):
        s[t, regimes[t]] = 1.0
        s[t] += rng.normal(0, 1.0 / max(snr, 1e-6), size=K)
    cols = [f"score_{r}" for r in REGIME_NAMES]
    return pd.DataFrame(s, columns=cols)


if __name__ == "__main__":
    df, reg = simulate_world(T=360, seed=42)
    sig = simulate_narrative_signal(reg, snr=1.0, seed=43)
    print("Returns head:\n", df.head())
    print("Regime counts:", np.bincount(reg, minlength=3))
    print("Signal head:\n", sig.head())
