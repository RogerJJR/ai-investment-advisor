"""
iterate_roi.py
--------------
30-iteration greedy improvement sweep for the Narrative Regimes allocator.

The iterations are organized in four "blocks":
  A. Iterations 1-8:   Hyperparameter / feature tuning (quick wins)
  B. Iterations 9-16:  Allocator mechanics (regime gamma, momentum, vol target, Kelly, CVaR)
  C. Iterations 17-24: Filter / signal enhancements
  D. Iterations 25-30: Risk-management composites + ensembles

Each iteration starts from the BEST config seen so far (greedy-best) and
proposes ONE change. If the change improves the headline metric
(default: CRRA-CE with tie-break on Max DD), it becomes the new baseline.
The full log, including *all* attempts (accepted and rejected), is written
to results/tables/iteration_log.csv.

Run:  python notebooks/iterate_roi.py
"""
from __future__ import annotations

import os
import sys
import json
import copy
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from src.simulator import simulate_world, simulate_narrative_signal
from src.regime_filter import FilterConfig, run_filter
from src.allocator_v2 import AllocConfigV2, allocate_v2
from src.backtest import run_backtest
from src.baselines import (
    equal_weight, sixty_forty, risk_parity, rolling_mean_variance,
)

TAB = os.path.join(ROOT, "results", "tables")
os.makedirs(TAB, exist_ok=True)


def sixty_forty_baseline_vector(n_assets: int = 7) -> np.ndarray:
    """Return the 60/40 weight vector for the 7-asset universe used as
    prior_baseline in allocator_v2 when posterior confidence is low."""
    w = np.zeros(n_assets)
    # equity-like: 0,1,2,6  => 60/4 each
    for i in (0, 1, 2, 6):
        w[i] = 0.60 / 4
    # bonds: 3,4 => 40/2 each
    for i in (3, 4):
        w[i] = 0.40 / 2
    return w


def run_one_config(cfg: AllocConfigV2, snr: float = 1.0, T: int = 360,
                   tc_bps: float = 10.0, gamma_eval: float = 5.0,
                   n_paths: int = 12, seed_base: int = 2000):
    """Run the configuration across n_paths Monte Carlo paths. Return summary dict."""
    stats_list = []
    for i in range(n_paths):
        seed = seed_base + i
        rets, reg = simulate_world(T=T, seed=seed)
        sig = simulate_narrative_signal(reg, snr=snr, seed=seed + 100000)
        fcfg = FilterConfig(use_narrative=True, narrative_weight=1.0)
        fres = run_filter(rets, sig, fcfg)
        W = allocate_v2(fres, rets, cfg,
                        prior_baseline=sixty_forty_baseline_vector(rets.shape[1]),
                        seed=seed)
        r = run_backtest(rets, W, gamma_eval, tc_bps)
        stats_list.append(r.stats)

    df = pd.DataFrame(stats_list)
    summary = {col: float(df[col].mean()) for col in df.columns}
    summary["crra_ce_annual_se"] = float(df["crra_ce_annual"].std() / np.sqrt(n_paths))
    summary["sharpe_se"] = float(df["sharpe"].std() / np.sqrt(n_paths))
    return summary


def score(s: dict) -> tuple:
    """Primary: CRRA-CE (higher better). Tie-break on |Max DD| (smaller |dd| better)."""
    return (s.get("crra_ce_annual", -1e9), -abs(s.get("max_drawdown", 1)))


# ---------------------------------------------------------------------------
# 30 iterations: each is a *function* that modifies a copy of the current cfg
# ---------------------------------------------------------------------------
def setter(**kw):
    def f(c):
        c2 = copy.copy(c)
        for k, v in kw.items():
            setattr(c2, k, v)
        return c2
    return f


ITERATIONS = [
    # --- BLOCK A: hyperparameter tuning ------------------------------------
    ("01 narrative_weight=2.0",  setter(),  # placeholder; we tune FilterConfig separately below
                                                                             ),
    ("02 mu_shrinkage=0.4",      setter(mu_shrinkage=0.4)),
    ("03 max_weight=0.50",       setter(max_weight=0.50)),
    ("04 max_weight=0.40",       setter(max_weight=0.40)),
    ("05 weight_inertia=0.85",   setter(weight_inertia=0.85)),
    ("06 weight_inertia=0.55",   setter(weight_inertia=0.55)),
    ("07 min_cash_equiv=0.05",   setter(min_cash_equiv=0.05)),
    ("08 min_cash_equiv=0.10",   setter(min_cash_equiv=0.10)),

    # --- BLOCK B: allocator mechanics --------------------------------------
    ("09 LW shrinkage (alpha=0.2)",  setter(use_lw_shrinkage=True, lw_alpha=0.2)),
    ("10 Regime-specific gamma",      setter(use_regime_gamma=True)),
    ("11 Entropy-confidence blend",   setter(use_entropy_conf=True, entropy_floor=0.45)),
    ("12 Momentum overlay (0.08)",    setter(use_momentum=True, momentum_strength=0.08)),
    ("13 Momentum strength=0.15",     setter(use_momentum=True, momentum_strength=0.15)),
    ("14 Vol targeting (10% annual)", setter(use_vol_target=True, vol_target_annual=0.10)),
    ("15 Vol targeting (8% annual)",  setter(use_vol_target=True, vol_target_annual=0.08)),
    ("16 CVaR cap (max=0.14)",        setter(use_cvar=True, cvar_max=0.14)),

    # --- BLOCK C: richer behaviours ----------------------------------------
    ("17 RP blend alpha=0.3",         setter(use_rp_blend=True, rp_blend_alpha=0.3)),
    ("18 RP blend alpha=0.5",         setter(use_rp_blend=True, rp_blend_alpha=0.5)),
    ("19 Michaud resample (n=30)",    setter(use_michaud=True, michaud_n_boot=30)),
    ("20 Rebalance threshold 0.03",   setter(rebalance_threshold=0.03)),
    ("21 Kelly scaling (cap=0.8)",    setter(use_kelly=True, kelly_cap=0.8)),
    ("22 Entropy floor 0.55",         setter(use_entropy_conf=True, entropy_floor=0.55)),
    ("23 Momentum + Vol target",      setter(use_momentum=True, momentum_strength=0.10,
                                              use_vol_target=True, vol_target_annual=0.09)),
    ("24 LW + Regime gamma + CVaR",   setter(use_lw_shrinkage=True, lw_alpha=0.2,
                                              use_regime_gamma=True,
                                              use_cvar=True, cvar_max=0.14)),

    # --- BLOCK D: composite + risk management -----------------------------
    ("25 All of A best + B best",     setter(use_lw_shrinkage=True, lw_alpha=0.2,
                                              use_regime_gamma=True,
                                              use_entropy_conf=True, entropy_floor=0.50,
                                              use_momentum=True, momentum_strength=0.10,
                                              use_vol_target=True, vol_target_annual=0.09,
                                              use_cvar=True, cvar_max=0.14,
                                              min_cash_equiv=0.05)),
    ("26 #25 + RP blend alpha=0.25",  setter(use_lw_shrinkage=True, lw_alpha=0.2,
                                              use_regime_gamma=True,
                                              use_entropy_conf=True, entropy_floor=0.50,
                                              use_momentum=True, momentum_strength=0.10,
                                              use_vol_target=True, vol_target_annual=0.09,
                                              use_cvar=True, cvar_max=0.14,
                                              min_cash_equiv=0.05,
                                              use_rp_blend=True, rp_blend_alpha=0.25)),
    ("27 #26 + Michaud n=20",          setter(use_lw_shrinkage=True, lw_alpha=0.2,
                                              use_regime_gamma=True,
                                              use_entropy_conf=True, entropy_floor=0.50,
                                              use_momentum=True, momentum_strength=0.10,
                                              use_vol_target=True, vol_target_annual=0.09,
                                              use_cvar=True, cvar_max=0.14,
                                              min_cash_equiv=0.05,
                                              use_rp_blend=True, rp_blend_alpha=0.25,
                                              use_michaud=True, michaud_n_boot=20)),
    ("28 #27 tighter cap=0.45",        setter(use_lw_shrinkage=True, lw_alpha=0.2,
                                              use_regime_gamma=True,
                                              use_entropy_conf=True, entropy_floor=0.50,
                                              use_momentum=True, momentum_strength=0.10,
                                              use_vol_target=True, vol_target_annual=0.09,
                                              use_cvar=True, cvar_max=0.14,
                                              min_cash_equiv=0.05,
                                              use_rp_blend=True, rp_blend_alpha=0.25,
                                              use_michaud=True, michaud_n_boot=20,
                                              max_weight=0.45)),
    ("29 #28 vol target 8%",           setter(use_lw_shrinkage=True, lw_alpha=0.2,
                                              use_regime_gamma=True,
                                              use_entropy_conf=True, entropy_floor=0.50,
                                              use_momentum=True, momentum_strength=0.10,
                                              use_vol_target=True, vol_target_annual=0.08,
                                              use_cvar=True, cvar_max=0.12,
                                              min_cash_equiv=0.05,
                                              use_rp_blend=True, rp_blend_alpha=0.25,
                                              use_michaud=True, michaud_n_boot=20,
                                              max_weight=0.45)),
    ("30 #29 + rebalance threshold 0.025",
                                         setter(use_lw_shrinkage=True, lw_alpha=0.2,
                                              use_regime_gamma=True,
                                              use_entropy_conf=True, entropy_floor=0.50,
                                              use_momentum=True, momentum_strength=0.10,
                                              use_vol_target=True, vol_target_annual=0.08,
                                              use_cvar=True, cvar_max=0.12,
                                              min_cash_equiv=0.05,
                                              use_rp_blend=True, rp_blend_alpha=0.25,
                                              use_michaud=True, michaud_n_boot=20,
                                              max_weight=0.45,
                                              rebalance_threshold=0.025)),
]


def _filter_cfg_for_iter(i):
    """Iteration 1 tunes the FilterConfig narrative weight — handled separately."""
    return FilterConfig(use_narrative=True, narrative_weight=2.0 if i == 0 else 1.0)


def run_one_iteration(i, cfg, snr=1.0, n_paths=12):
    """Variant of run_one_config that allows passing FilterConfig override."""
    stats_list = []
    fcfg = _filter_cfg_for_iter(i)
    seed_base = 2000
    T = 360
    tc_bps = 10.0
    gamma_eval = 5.0
    for j in range(n_paths):
        seed = seed_base + j
        rets, reg = simulate_world(T=T, seed=seed)
        sig = simulate_narrative_signal(reg, snr=snr, seed=seed + 100000)
        fres = run_filter(rets, sig, fcfg)
        W = allocate_v2(fres, rets, cfg,
                        prior_baseline=sixty_forty_baseline_vector(rets.shape[1]),
                        seed=seed)
        r = run_backtest(rets, W, gamma_eval, tc_bps)
        stats_list.append(r.stats)
    df = pd.DataFrame(stats_list)
    summary = {col: float(df[col].mean()) for col in df.columns}
    summary["crra_ce_annual_se"] = float(df["crra_ce_annual"].std() / np.sqrt(n_paths))
    summary["sharpe_se"] = float(df["sharpe"].std() / np.sqrt(n_paths))
    return summary


def main(n_paths: int = 12):
    # Baseline: current paper config (regime-policy-mix only, inertia 0.7, shrink 0.2)
    base = AllocConfigV2()
    log_rows = []
    # Baseline score
    s0 = run_one_iteration(-1, base, n_paths=n_paths)
    log_rows.append({"iter": 0, "name": "baseline", **s0, "accepted": True})
    best = s0
    best_cfg = base
    best_name = "baseline"

    for i, (name, mk) in enumerate(ITERATIONS, start=1):
        trial = mk(best_cfg)  # start from current best (greedy)
        s = run_one_iteration(i - 1, trial, n_paths=n_paths)
        accepted = score(s) > score(best)
        log_rows.append({"iter": i, "name": name, **s, "accepted": accepted})
        print(f"[{i:02d}] {name:40s}  CRRA-CE={s['crra_ce_annual']:.4f}  "
              f"Sharpe={s['sharpe']:.3f}  MDD={s['max_drawdown']:.3f}  "
              f"{'ACCEPT' if accepted else 'reject'}")
        if accepted:
            best, best_cfg, best_name = s, trial, name

    df = pd.DataFrame(log_rows)
    df.to_csv(os.path.join(TAB, "iteration_log.csv"), index=False)
    print("\nBest config:", best_name)
    print("Best stats:", json.dumps(best, indent=2))
    with open(os.path.join(TAB, "best_config.json"), "w") as f:
        json.dump({"name": best_name, "stats": best,
                   "cfg": {k: getattr(best_cfg, k) for k in best_cfg.__dataclass_fields__}},
                  f, indent=2, default=str)


if __name__ == "__main__":
    main(n_paths=12)
