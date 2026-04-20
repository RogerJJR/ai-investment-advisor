"""
run_all.py — full experimental suite.

Produces all tables and figures consumed by the LaTeX paper.

Outputs saved to ../results/tables/ and ../results/figures/
"""
from __future__ import annotations

import os
import sys
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from src.simulator import simulate_world, simulate_narrative_signal, ASSET_NAMES, REGIME_NAMES
from src.regime_filter import FilterConfig, run_filter
from src.allocator import AllocConfig, allocate_from_posterior
from src.allocator_v2 import AllocConfigV2, allocate_v2
from src.backtest import run_backtest
from src.baselines import equal_weight, sixty_forty, risk_parity, rolling_mean_variance

TAB_DIR = os.path.join(ROOT, "results", "tables")
FIG_DIR = os.path.join(ROOT, "results", "figures")
os.makedirs(TAB_DIR, exist_ok=True)
os.makedirs(FIG_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Core simulation primitive
# ---------------------------------------------------------------------------
def one_path(seed, T, snr, tc_bps, gamma, use_narrative, narrative_weight=1.0):
    rets, reg = simulate_world(T=T, seed=seed)
    signals = simulate_narrative_signal(reg, snr=snr, seed=seed + 10_000)
    fcfg = FilterConfig(
        use_narrative=use_narrative,
        narrative_weight=narrative_weight,
    )
    fres = run_filter(rets, signals, fcfg)
    acfg = AllocConfig(risk_aversion=gamma, long_only=True, max_weight=0.60, tc_bps=tc_bps)
    W = allocate_from_posterior(fres.posterior, fres.mu_k_hist, fres.cov_k_hist, acfg)
    return rets, reg, signals, fres, W


def _load_best_config_v2():
    """Load iterated best config from Workflow A. Returns (AllocConfigV2, name)."""
    path = os.path.join(TAB_DIR, "best_config.json")
    with open(path) as f:
        bc = json.load(f)
    cfg = AllocConfigV2(**bc["cfg"])
    return cfg, bc.get("name", "iterated")


def _sixty_forty_vector(n_assets: int = 7) -> np.ndarray:
    w = np.zeros(n_assets)
    for i in (0, 1, 2, 6):
        w[i] = 0.60 / 4
    for i in (3, 4):
        w[i] = 0.40 / 2
    return w


def one_path_v2(seed, T, snr, tc_bps, gamma, cfg_v2):
    """Same pipeline as one_path() but uses allocator_v2.allocate_v2."""
    rets, reg = simulate_world(T=T, seed=seed)
    signals = simulate_narrative_signal(reg, snr=snr, seed=seed + 10_000)
    fcfg = FilterConfig(use_narrative=True, narrative_weight=1.0)
    fres = run_filter(rets, signals, fcfg)
    W = allocate_v2(fres, rets, cfg_v2,
                    prior_baseline=_sixty_forty_vector(rets.shape[1]),
                    seed=seed)
    return rets, reg, signals, fres, W


def classification_accuracy(post_df, reg_true):
    pred = np.argmax(post_df.values, axis=1)
    mask = ~np.isnan(post_df.values[:, 0])
    return float((pred[mask] == reg_true[mask]).mean())


def summarize(res_list, name):
    df = pd.DataFrame([r.stats for r in res_list])
    out = {"strategy": name}
    for col in df.columns:
        out[col + "_mean"] = df[col].mean()
        out[col + "_std"] = df[col].std()
    return out


# ---------------------------------------------------------------------------
# Experiment 1: Main Monte Carlo comparison at baseline configuration
# ---------------------------------------------------------------------------
def experiment_main(n_paths=30, T=360, snr=1.0, tc_bps=10.0, gamma=5.0):
    strategies = {
        "NarrativeRegimes": [],
        "NarrativeRegimesV2": [],
        "RegimeOnly": [],
        "EqualWeight": [],
        "SixtyForty": [],
        "RiskParity": [],
        "RollingMV": [],
        "MomentMix": [],
    }
    cfg_v2, _ = _load_best_config_v2()
    acc_narr, acc_noreg = [], []
    for i in range(n_paths):
        seed = 100 + i
        rets, reg, sig, fres, W_our = one_path(seed, T, snr, tc_bps, gamma, True)
        strategies["NarrativeRegimes"].append(
            run_backtest(rets, W_our, gamma, tc_bps)
        )
        acc_narr.append(classification_accuracy(fres.posterior, reg))

        _, _, _, _, W_v2 = one_path_v2(seed, T, snr, tc_bps, gamma, cfg_v2)
        strategies["NarrativeRegimesV2"].append(
            run_backtest(rets, W_v2, gamma, tc_bps)
        )

        _, _, _, fres2, W_our2 = one_path(seed, T, snr, tc_bps, gamma, False)
        strategies["RegimeOnly"].append(run_backtest(rets, W_our2, gamma, tc_bps))
        acc_noreg.append(classification_accuracy(fres2.posterior, reg))

        strategies["EqualWeight"].append(
            run_backtest(rets, equal_weight(rets), gamma, tc_bps))
        strategies["SixtyForty"].append(
            run_backtest(rets, sixty_forty(rets), gamma, tc_bps))
        strategies["RiskParity"].append(
            run_backtest(rets, risk_parity(rets), gamma, tc_bps))
        strategies["RollingMV"].append(
            run_backtest(rets, rolling_mean_variance(rets, risk_aversion=gamma), gamma, tc_bps))

        acfg_mm = AllocConfig(risk_aversion=gamma, long_only=True, max_weight=0.60, tc_bps=tc_bps)
        W_mm = allocate_from_posterior(fres.posterior, fres.mu_k_hist, fres.cov_k_hist,
                                       acfg_mm, mode="moment_mix")
        strategies["MomentMix"].append(run_backtest(rets, W_mm, gamma, tc_bps))

    rows = [summarize(v, k) for k, v in strategies.items()]
    out_df = pd.DataFrame(rows)

    acc_summary = pd.DataFrame({
        "mode": ["WithNarrative", "WithoutNarrative"],
        "mean_accuracy": [np.mean(acc_narr), np.mean(acc_noreg)],
        "std_accuracy": [np.std(acc_narr), np.std(acc_noreg)],
    })
    return out_df, acc_summary, strategies


# ---------------------------------------------------------------------------
# Experiment 2: SNR sweep — how much does LLM signal quality matter?
# ---------------------------------------------------------------------------
def experiment_snr(n_paths=20, T=360, snrs=(0.25, 0.5, 1.0, 2.0, 4.0), gamma=5.0, tc_bps=10.0):
    rows = []
    for snr in snrs:
        for i in range(n_paths):
            seed = 500 + i
            rets, reg, sig, fres, W_our = one_path(seed, T, snr, tc_bps, gamma, True)
            r = run_backtest(rets, W_our, gamma, tc_bps)
            row = {"snr": snr, "strategy": "NarrativeRegimes"}
            row.update(r.stats); row["accuracy"] = classification_accuracy(fres.posterior, reg)
            rows.append(row)
            _, _, _, fres2, W_r = one_path(seed, T, snr, tc_bps, gamma, False)
            r2 = run_backtest(rets, W_r, gamma, tc_bps)
            row2 = {"snr": snr, "strategy": "RegimeOnly"}
            row2.update(r2.stats); row2["accuracy"] = classification_accuracy(fres2.posterior, reg)
            rows.append(row2)
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Experiment 3: Transaction-cost sweep
# ---------------------------------------------------------------------------
def experiment_tc(n_paths=20, T=360, snr=1.0, tcs=(0, 5, 10, 20, 50), gamma=5.0):
    rows = []
    for tc in tcs:
        for i in range(n_paths):
            seed = 900 + i
            rets, reg, sig, fres, W_our = one_path(seed, T, snr, tc, gamma, True)
            r = run_backtest(rets, W_our, gamma, tc)
            row = {"tc_bps": tc, "strategy": "NarrativeRegimes"}
            row.update(r.stats); rows.append(row)

            rp = run_backtest(rets, risk_parity(rets), gamma, tc)
            row2 = {"tc_bps": tc, "strategy": "RiskParity"}
            row2.update(rp.stats); rows.append(row2)

            sf = run_backtest(rets, sixty_forty(rets), gamma, tc)
            row3 = {"tc_bps": tc, "strategy": "SixtyForty"}
            row3.update(sf.stats); rows.append(row3)
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Experiment 4: Risk-aversion sweep
# ---------------------------------------------------------------------------
def experiment_gamma(n_paths=20, T=360, snr=1.0, tc_bps=10.0, gammas=(2, 5, 10)):
    rows = []
    for g in gammas:
        for i in range(n_paths):
            seed = 1300 + i
            rets, reg, sig, fres, W_our = one_path(seed, T, snr, tc_bps, g, True)
            r = run_backtest(rets, W_our, g, tc_bps)
            row = {"risk_aversion": g, "strategy": "NarrativeRegimes"}
            row.update(r.stats); rows.append(row)
            sf = run_backtest(rets, sixty_forty(rets), g, tc_bps)
            row2 = {"risk_aversion": g, "strategy": "SixtyForty"}
            row2.update(sf.stats); rows.append(row2)
            rp = run_backtest(rets, risk_parity(rets), g, tc_bps)
            row3 = {"risk_aversion": g, "strategy": "RiskParity"}
            row3.update(rp.stats); rows.append(row3)
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Plotting helpers
# ---------------------------------------------------------------------------
def plot_equity_paths(strategies, path=os.path.join(FIG_DIR, "fig_equity_paths.pdf")):
    fig, ax = plt.subplots(figsize=(6.5, 3.8))
    colors = {"NarrativeRegimes": "C0", "NarrativeRegimesV2": "C6",
              "SixtyForty": "C1", "RiskParity": "C2",
              "EqualWeight": "C3", "RollingMV": "C4", "RegimeOnly": "C5"}
    for name, runs in strategies.items():
        mean_eq = np.mean([r.equity.values for r in runs], axis=0)
        idx = runs[0].equity.index
        ax.plot(idx, mean_eq, label=name, color=colors.get(name), linewidth=1.4)
    ax.set_ylabel("Mean equity (normalized to 1.0)")
    ax.set_xlabel("Date")
    ax.legend(fontsize=7, ncol=2, frameon=False)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def plot_snr_curve(df_snr, path=os.path.join(FIG_DIR, "fig_snr_curve.pdf")):
    fig, ax = plt.subplots(figsize=(6.5, 3.5))
    for strat in ["NarrativeRegimes", "RegimeOnly"]:
        sub = df_snr[df_snr.strategy == strat].groupby("snr")["crra_ce_annual"].agg(["mean", "std"])
        ax.errorbar(sub.index, sub["mean"], yerr=sub["std"] / np.sqrt(20), label=strat, capsize=3)
    ax.set_xscale("log")
    ax.set_xlabel("Signal-to-Noise Ratio (SNR)")
    ax.set_ylabel("CRRA Certainty-Equivalent Annual Return")
    ax.legend(fontsize=8, frameon=False)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def plot_regime_posterior(rets, reg, post, path=os.path.join(FIG_DIR, "fig_regime_post.pdf")):
    fig, ax = plt.subplots(figsize=(6.5, 3.4))
    for k in range(3):
        ax.plot(post.index, post[f"post_{k}"], label=REGIME_NAMES[k], linewidth=1.0, alpha=0.9)
    # True regime as shaded background
    ax2 = ax.twinx()
    ax2.step(post.index, reg, where="post", color="k", alpha=0.25, linewidth=0.8, label="True regime")
    ax2.set_yticks([0, 1, 2])
    ax2.set_yticklabels(REGIME_NAMES, fontsize=7)
    ax.set_ylabel("Posterior probability")
    ax.set_xlabel("Date")
    ax.legend(fontsize=8, loc="upper left", frameon=False)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print(">>> Experiment 1: main Monte Carlo ...")
    main_df, acc_df, strategies = experiment_main(n_paths=30)
    main_df.to_csv(os.path.join(TAB_DIR, "table_main.csv"), index=False)
    acc_df.to_csv(os.path.join(TAB_DIR, "table_accuracy.csv"), index=False)
    plot_equity_paths(strategies)

    # For the single representative-path posterior plot, run one more path
    rets_r, reg_r, _, fres_r, _ = one_path(seed=42, T=360, snr=1.0, tc_bps=10.0, gamma=5.0, use_narrative=True)
    plot_regime_posterior(rets_r, reg_r, fres_r.posterior)

    print(">>> Experiment 2: SNR sweep ...")
    df_snr = experiment_snr(n_paths=20)
    df_snr.to_csv(os.path.join(TAB_DIR, "table_snr.csv"), index=False)
    plot_snr_curve(df_snr)

    print(">>> Experiment 3: TC sweep ...")
    df_tc = experiment_tc(n_paths=12)
    df_tc.to_csv(os.path.join(TAB_DIR, "table_tc.csv"), index=False)

    print(">>> Experiment 4: gamma sweep ...")
    df_g = experiment_gamma(n_paths=12)
    df_g.to_csv(os.path.join(TAB_DIR, "table_gamma.csv"), index=False)

    print(">>> Finished. Summary:")
    cols = ["strategy", "annual_return_mean", "annual_vol_mean", "sharpe_mean",
            "max_drawdown_mean", "calmar_mean", "crra_ce_annual_mean", "avg_turnover_mean"]
    print(main_df[cols].to_string(index=False))
    print("\nClassification accuracy:")
    print(acc_df.to_string(index=False))


if __name__ == "__main__":
    main()
