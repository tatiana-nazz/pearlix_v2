from pathlib import Path


def test_review_presentation_policy_matches_release_behavior():
    doc = (Path(__file__).resolve().parents[2] / "project_docs" / "REVIEW_PRESENTATION_POLICY.md").read_text(encoding="utf-8")

    assert "[0.30, 0.44)" in doc
    assert "does not show `REVIEW` rows" in doc
    assert "do not draw boxes or labels for review-only teeth" in doc
    assert "locked positive threshold of `0.44`" in doc
    assert "Deep Caries still forces Any Caries positive" in doc
