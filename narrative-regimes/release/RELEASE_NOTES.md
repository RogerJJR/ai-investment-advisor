# Release Notes — v0.2.0-preprint (2026-04-20)

**Second preprint of *Narrative Regimes: LLM-Augmented Strategic Asset Allocation for Long-Horizon Investors*, adding an iterated allocator variant and a regenerated 30-path Monte-Carlo reporting fold.**

## What's new since v0.1.0

- **Iterated allocator variant** (`src/allocator_v2.py`, `AllocConfigV2`) produced by a 30-iteration greedy sweep over eight orthogonal enhancement toggles (`notebooks/iterate_roi.py`). Nine changes accepted; composite enables a fixed-alpha diagonal shrinkage proxy ($\alpha=0.2$), regime-specific risk aversion, and 8% annualised volatility targeting.
- **Sweep isolation**: the iteration selector runs on seeds 2000–2011, disjoint from the Table 1 reporting fold (100–129), so the headline gain is measured out of sample relative to the selector.
- **Refreshed headline numbers** (30 Monte-Carlo paths, γ=5, β=1, τ=10 bps):
  - Narrative Regimes (baseline): Sharpe 0.30, MDD −22.7%, CRRA-CE 2.77%, monthly turnover 7.5%
  - Narrative Regimes (iterated): Sharpe 0.32, MDD −18.7%, CRRA-CE 3.04%, monthly turnover 3.7%
  - Risk parity: Sharpe 0.28, CRRA-CE 2.56%
  - 60/40: Sharpe 0.23, CRRA-CE 1.11%
  - 1/N: Sharpe 0.21, CRRA-CE 0.66%
- **Rewritten transaction-cost sensitivity**: replaces the previous single-seed verification with 12-path Monte-Carlo means over τ ∈ {0, 5, 10, 20, 50} bps. Narrative Regimes CRRA-CE slides from 3.66% → 3.33%; framework retains a 66 bps lead over risk parity and 186 bps over 60/40 at τ=50 bps.
- **Moment-mix ablation** now reported alongside the regime-policy-mix baseline.
- **Round-5 peer review**: four reviewers (methodology, empirical, AI, presentation) all ACCEPT; copy-edits addressed (SE caveat on +27 bps CRRA-CE, vol-target-to-Treasuries disclosure, LW-proxy labelling, TC-gap arithmetic fix, AI-declaration round count).

## What's included

| File | Description |
| --- | --- |
| `paper/main.tex` | Full LaTeX manuscript (Elsevier `elsarticle`, Harvard) targeting *Decision Support Systems* |
| `paper/references.bib` | Reference database |
| `paper/elsevier-harvard.csl` | Harvard CSL for external tooling |
| `paper/ai_usage_declaration.md` | CRediT-aligned AI usage statement |
| `src/` | Python implementation: simulator, filter, allocator (v1 + v2), enhancements, baselines, backtest |
| `notebooks/run_all.py` | End-to-end Monte-Carlo experiment driver |
| `notebooks/iterate_roi.py` | 30-iteration greedy ROI sweep driver |
| `results/tables/` | CSV tables: main, accuracy, SNR, TC, gamma, iteration log, best_config |
| `results/figures/` | PDF figures reproduced in the paper |
| `reviews/round1`..`round5` | 20 reviewer records across five rounds of internal peer review |
| `README.md` | Traditional-Chinese project overview |
| `ABSTRACT_zh-TW.md` | Traditional-Chinese abstract |
| `LICENSE` | MIT |
| `CITATION.cff` | Citation metadata |

## Peer-review history

- **Round 1** — 3 × MAJOR REVISION, 1 × MINOR REVISION. Headline-number mismatch, TC pipeline bug, unsupported CRRA claim, AI declaration placement.
- **Round 2** — 4 × MINOR REVISION. Round-1 headline issues addressed.
- **Round 3** — 4 × ACCEPT (one non-blocking TC remark).
- **Round 4** — 4 × ACCEPT, copy-edit pass.
- **Round 5** — 4 × ACCEPT on the iterated-allocator revision. Methodology reviewer requested (and authors implemented) a Ledoit–Wolf-proxy label, an explicit +27 bps ≈ 1 SE caveat, and a vol-target-to-Treasuries disclosure; presentation reviewer caught a 79→66 bps arithmetic slip in the TC paragraph.

## Known limitations

1. **Empirical replication** — this remains a simulation-based methodology paper. A post-LLM-cutoff empirical replication is the natural next step and should be conducted with a trusted third party to preclude implicit look-ahead during filter development.
2. **Signal model richness** — the narrative-signal abstraction (noisy one-hot + isotropic Gaussian) is deliberate; a Dirichlet-Gaussian extension is noted in Limitations.
3. **Shrinkage label** — `src/enhancements.py:lw_shrink` implements a fixed-alpha diagonal shrinkage proxy rather than the data-driven Ledoit–Wolf optimal intensity; this is now explicitly framed in the paper.

## License

MIT (see `LICENSE`).

## Contact

Roger Chuang (`roger.chuang@jjr.com.tw`)
