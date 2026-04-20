"""
backtest.py
-----------
Portfolio backtesting engine with monthly rebalancing, transaction costs,
and drift between rebalances.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass


@dataclass
class BacktestResult:
    equity: pd.Series
    portfolio_returns: pd.Series
    weights: pd.DataFrame
    turnover: pd.Series
    stats: dict


def run_backtest(
    returns: pd.DataFrame,
    target_weights: pd.DataFrame,
    risk_aversion: float = 5.0,
    tc_bps: float = 10.0,
    rf_monthly: float = 0.02 / 12.0,
    drift: bool = True,
) -> BacktestResult:
    """target_weights has same index as returns. We lag by one period so the
    allocation computed with info up to t is only applied from t+1 onward
    (no look-ahead)."""
    rets = returns.values
    W = target_weights.shift(1).values
    T, N = rets.shape

    equity = np.ones(T)
    port_ret = np.zeros(T)
    turnover = np.zeros(T)

    first_valid = 0
    while first_valid < T and np.any(np.isnan(W[first_valid])):
        first_valid += 1
    if first_valid >= T:
        idx = returns.index
        return BacktestResult(pd.Series(equity, index=idx),
                              pd.Series(port_ret, index=idx),
                              target_weights,
                              pd.Series(turnover, index=idx),
                              {})

    w_eff = W[first_valid].copy()

    for t in range(first_valid, T):
        cost = 0.0
        if not np.any(np.isnan(W[t])):
            to = np.abs(W[t] - w_eff).sum()
            cost = to * (tc_bps / 10000.0)
            w_eff = W[t].copy()
            turnover[t] = to
        r = rets[t]
        pr_gross = w_eff @ r
        pr_net = (1 + pr_gross) * (1 - cost) - 1
        port_ret[t] = pr_net
        equity[t] = equity[t-1] * (1 + pr_net) if t > 0 else (1 + pr_net)
        if drift:
            w_eff = w_eff * (1 + r)
            s = w_eff.sum()
            if s > 0:
                w_eff = w_eff / s

    idx = returns.index
    eq = pd.Series(equity, index=idx, name="equity")
    pr = pd.Series(port_ret, index=idx, name="port_ret")
    to_s = pd.Series(turnover, index=idx, name="turnover")

    pr_valid = pr.iloc[first_valid:]
    eq_valid = eq.iloc[first_valid:]
    mu = pr_valid.mean() * 12
    sd = pr_valid.std() * np.sqrt(12)
    sharpe = (pr_valid.mean() - rf_monthly) / pr_valid.std() * np.sqrt(12) if pr_valid.std() > 0 else np.nan
    downside = pr_valid[pr_valid < rf_monthly]
    sortino = (pr_valid.mean() - rf_monthly) / downside.std() * np.sqrt(12) if len(downside) > 5 and downside.std() > 0 else np.nan
    running_max = eq_valid.cummax()
    dd = eq_valid / running_max - 1
    mdd = dd.min()
    cagr = eq_valid.iloc[-1] ** (12 / len(eq_valid)) - 1
    calmar = cagr / abs(mdd) if mdd < 0 else np.nan

    gamma = risk_aversion
    if gamma == 1:
        ce = np.exp(np.log(1 + pr_valid).mean()) - 1
    else:
        u = ((1 + pr_valid) ** (1 - gamma) - 1) / (1 - gamma)
        ce = (1 + (1 - gamma) * u.mean()) ** (1 / (1 - gamma)) - 1

    stats = {
        "annual_return": mu,
        "annual_vol": sd,
        "cagr": cagr,
        "sharpe": sharpe,
        "sortino": sortino,
        "max_drawdown": mdd,
        "calmar": calmar,
        "avg_turnover": to_s.iloc[first_valid:].mean(),
        "crra_ce_annual": (1 + ce) ** 12 - 1,
    }

    return BacktestResult(
        equity=eq, portfolio_returns=pr, weights=target_weights,
        turnover=to_s, stats=stats,
    )
