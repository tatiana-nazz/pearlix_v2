# Review-band presentation policy

The locked DENTEX classifier contract is unchanged. Any Caries scores in the interval `[0.30, 0.44)` remain represented internally as `REVIEW` decisions for research/audit traceability.

Clinician-facing presentation intentionally excludes review-only decisions:

- the standard AI findings table does not show `REVIEW` rows;
- AI overlays do not draw boxes or labels for review-only teeth;
- the overlay legend therefore lists only the four FDI quadrant colors used for positive findings.

A review-only decision is not a positive prediction and does not alter the locked positive threshold of `0.44`. Deep Caries still forces Any Caries positive after thresholding.

Historical Notebook 05 (`05_Experiment_1_FINAL_END_TO_END_INFERENCE_v4_JAW_AWARE_LABELS.ipynb`) contains the earlier orange review-overlay presentation. It is retained as executed research evidence rather than silently rewritten. Pearlix production presentation intentionally differs from that historical display-only behavior while preserving the same model scores, thresholds, hierarchy, and persisted review state.
