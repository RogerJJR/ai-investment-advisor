"""
run_experiment.py
-----------------
Main driver: simulate a long-horizon regime-switching world, run the
LLM-augmented allocator against baselines under multiple Monte Carlo paths,
and compile summary statistics and robustness tables.
"""
from __future__ import annotations

import os
import sys
import json
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from src.simulator import simulate_world, simulate_narrative_signal, default_regime_specs, DEFAULT_P
from src.regime_filter import FilterConfig, run_filter
from src.allocator import AllocConfig, allocate_from_posterior
from src.backtest import run_backtest
from src.baselines import equal_weight, sixty_forty, risk_parity, rolling_mean_variance


def run_single_path(
    seed: int,
    T: int = 360,
    snr: float = 1.0,
    tc_bps: float = 10.0,
    risk_aversion: float = 5.0,
    use_narrative: bool = True,
):
    rets, reg = simulate_world(T=T, seed=seed)
    signals = simulate_narrative_signal(reg, snr=snr, seed=seed + 1000)

    cfg_f = FilterConfig(use_narrative=use_narrative, narrative_weight=1.0)
    fres = run_filter(rets, signals, cfg_f)

    cfg_a = AllocConfig(risk_aversion=risk_aversion, long_only=True, max_weight=0.60, tc_bps=tc_bps)
    w_ours = allocate_from_posterior(fres.posterior, fres.mu_k_hist, fres.cov_k_hist, cfg_a)

    baselines = {
        "EqualWeight": equal_weight(rets),
        "SixtyForty": sixty_forty(rets),
        "RiskParity": risk_parity(rets),
        "RollingMV": rolling_mean_variance(rets, risk_aversion=risk_aversion),
    }

    name_ours = "NarrativeRegimes" if use_narrative else "RegimeOnly"
    res = {name_ours: run_backtest(rets, w_ours, risk_aversion=risk_aversion, tc_bps=tc_bps)}
    for name, W in baselines.items():
        res[name] = run_backtest(rets, W, risk_aversion=risk_aversion, tc_bps=tc_bps)

    rows = []
    for name, r in res.items():
        row = {"strategy": name, "seed": seed, "snr": snr, "tc_bps": tc_bps,
               "risk_aversion": risk_aversion}
        row.update(r.stats)
        rows.append(row)
    return pd.DataFrame(rows), res, reg, fres.posterior


def run_monte_carlo(
    n_paths: int = 30,
    T: int = 360,
    snr: float = 1.0,
    tc_bps: float = 10.0,
    risk_aversion: float = 5.0,
    seed_base: int = 100,
    include_narrative_ablation: bool = False,
):
    all_rows = []
    for i in range(n_paths):
        df, *_ = run_single_path(
            seed=seed_base + i, T=T, snr=snr, tc_bps=tc_bps,
            risk_aversion=risk_aversion, use_narrative=True,
        )
        all_rows.append(df)
        if include_narrative_ablation:
            df2, *_ = run_single_path(
                seed=seed_base + i, T=T, snr=snr, tc_bps=tc_bps,
                risk_aversion=risk_aversion, use_narrative=False,
            )
            df2 = df2[df2["strategy"] == "RegimeOnly"]
            all_rows.append(df2)
    return pd.concat(all_rows, ignore_index=True)


if __name__ == "__main__":
    print("Running single-path sanity check...")
    df_single, res_single, reg, post = run_single_path(seed=42, T=360)
    print(df_single[["strategy", "annual_return", "annual_vol", "sharpe",
                     "max_drawdown", "calmar", "crra_ce_annual", "avg_turnover"]])
