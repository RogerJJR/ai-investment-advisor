# AI Usage Declaration

**Manuscript:** *Narrative Regimes: LLM-Augmented Strategic Asset Allocation for Long-Horizon Investors*
**Author:** Roger Chuang (roger.chuang@jjr.com.tw)
**Target venue:** Decision Support Systems (Elsevier)
**Date:** 2026-04-20

## Summary

This paper was produced with substantial assistance from a large language model (Claude by Anthropic). Per Elsevier's policy on the use of generative AI in scientific writing (CRediT-aligned disclosure), the specific uses were:

| Role | LLM contribution | Author's role |
| --- | --- | --- |
| Conceptualization | Literature scoping; framing of novelty vis-à-vis prior LLM-portfolio work | Final selection of research question and contributions |
| Methodology | Proposed and scaffolded the online Bayesian regime filter and regime-policy-mix allocator | Mathematical formalisation, calibration, ablation design |
| Software | Drafted the initial Python implementation (simulator, filter, allocator, backtest, baselines) | Inspection, debugging (including one null-byte corruption and one transaction-cost accounting bug), refactoring, and final verification |
| Validation | Suggested Monte-Carlo paths, seeds, and robustness cuts | Ran all experiments; inspected all outputs |
| Writing – original draft | First draft of manuscript sections and LaTeX scaffolding | Content edits, figure/table selection, narrative structure |
| Writing – review & editing | Five internal peer-review rounds simulating external reviewers | Decided which comments to accept and implement |
| Visualization | Drafted plotting code | Reviewed and adjusted final figures |
| Supervision | — | Author |

## What the LLM did *not* do

- The LLM did not access proprietary or restricted data.
- The LLM did not independently collect or generate empirical data: all results come from a deterministic simulation with disclosed seeds.
- The LLM did not fabricate citations; all references were verified by the author against primary sources or arXiv identifiers. Three working papers (marked in `references.bib` with arXiv IDs) are prior-reviewed preprints; the author bears responsibility for any residual citation errors.
- The LLM is not listed as an author, consistent with journal policy.

## Reproducibility

All code, experiments, and this manuscript are released under the MIT licence at:
<https://github.com/<your-username>/narrative-regimes>. Anyone running the supplied replication scripts with the disclosed seeds will obtain results that match those reported to within floating-point precision.

## Contact

Questions, corrections, or reports of integrity concerns should be directed to the corresponding author at roger.chuang@jjr.com.tw.
