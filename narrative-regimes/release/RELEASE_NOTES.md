# Release Notes — v0.1.0-preprint (2026-04-20)

**First public preprint of *Narrative Regimes: LLM-Augmented Strategic Asset Allocation for Long-Horizon Investors*.**

## What's included

| File | Description |
| --- | --- |
| `paper/main.tex` | Full 10–12 page LaTeX manuscript (Elsevier `elsarticle` class, Harvard style) targeting *Decision Support Systems* |
| `paper/references.bib` | 27 references including DSS-native and recent LLM-in-finance work |
| `paper/elsevier-harvard.csl` | Harvard CSL for external tooling |
| `paper/figures/` | SNR curve, regime posterior path, and equity curves |
| `paper/ai_usage_declaration.md` | Standalone CRediT-aligned AI usage statement |
| `src/` | Python implementation (simulator, filter, allocator, baselines, backtest) — pure `numpy` / `pandas`, no external market data required |
| `notebooks/run_all.py` | End-to-end Monte Carlo experiment driver |
| `results/tables/` | CSV tables for main comparison, accuracy, SNR sweep, TC sweep, gamma sweep |
| `results/figures/` | PDF figures reproduced in the paper |
| `reviews/` | 16 reviewer records from four rounds of internal peer review |
| `README.md` | Traditional-Chinese project overview |
| `ABSTRACT_zh-TW.md` | Traditional-Chinese abstract |
| `LICENSE` | MIT |
| `CITATION.cff` | Citation metadata |

## Peer-review history

- **Round 1** — 3 × MAJOR REVISION, 1 × MINOR REVISION. Main issues: headline-number mismatch between abstract and table, TC pipeline bug, unsupported CRRA-approximation claim, AI declaration placement.
- **Round 2** — 4 × MINOR REVISION. All round-1 headline issues addressed; remaining items were incremental disclosure and robustness checks.
- **Round 3** — 4 × ACCEPT (one with non-blocking camera-ready remark about the TC table).
- **Round 4** — 4 × ACCEPT, confirming copy-edit pass.

## Known limitations flagged for camera-ready

1. **Multi-path TC sweep** — downgraded to a single-seed verification in the current preprint because the compute environment used to regenerate the CSV was unavailable during finalisation; the `table_tc.csv` in `results/tables/` is flagged as pending re-run.
2. **Empirical replication** — the current paper is a simulation-based methodology paper. A post-LLM-cutoff empirical replication is the natural next step and should be conducted with a trusted third party to preclude implicit look-ahead during filter development.
3. **Signal model richness** — the narrative-signal abstraction (noisy one-hot + isotropic Gaussian) is a deliberate simplification; a Dirichlet-Gaussian extension is suggested in the Limitations section.

## License

MIT (see `LICENSE`).

## Contact

Roger Chuang (`roger.chuang@jjr.com.tw`)
