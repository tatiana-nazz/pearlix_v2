from apps.ai_results.overlay import (
    QUADRANT_COLORS,
    overlay_scale,
    preferred_label_top,
    select_overlay_finding,
)
from apps.ai_results.result_types import DetectedTooth, FindingDecision, ToothScores, apply_locked_policy


def decide(fdi, any_caries, deep=0.0, impacted=0.0, lesion=0.0):
    tooth = DetectedTooth(fdi_tooth_id=fdi, detector_confidence=0.9, bbox_xyxy=(10, 20, 100, 120))
    return apply_locked_policy(tooth, ToothScores((any_caries, deep, impacted, lesion)))


def test_overlay_suppresses_generic_any_caries_when_deep_is_flagged():
    finding = select_overlay_finding(decide("36", 0.60, deep=0.70, lesion=0.80))

    assert finding.flagged_diseases == ("Deep Caries", "Periapical Lesion")


def test_overlay_hides_review_only_decisions_but_preserves_policy_state():
    review_decision = decide("11", 0.30)
    review = select_overlay_finding(review_decision)
    review_with_positive = select_overlay_finding(decide("11", 0.30, impacted=0.60))

    assert review_decision.any_caries_decision == FindingDecision.REVIEW
    assert review.flagged_diseases == ()
    assert review_with_positive.flagged_diseases == ("Impacted",)


def test_overlay_jaw_placement_and_scale_formulas_are_exact():
    assert preferred_label_top(quadrant="1", bbox_y1=100, bbox_y2=150, block_height=80, margin=8) == 12
    assert preferred_label_top(quadrant="2", bbox_y1=100, bbox_y2=150, block_height=80, margin=8) == 12
    assert preferred_label_top(quadrant="3", bbox_y1=100, bbox_y2=150, block_height=80, margin=8) == 158
    assert preferred_label_top(quadrant="4", bbox_y1=100, bbox_y2=150, block_height=80, margin=8) == 158

    scale = overlay_scale(1350, 2500)
    assert scale.font_scale == 1.0
    assert scale.text_thickness == 2
    assert scale.box_thickness == 3
    assert scale.line_height == 34
    assert scale.margin == 8


def test_overlay_colors_match_positive_finding_palette():
    assert QUADRANT_COLORS == {
        "1": (0, 230, 130),
        "2": (255, 75, 45),
        "3": (0, 190, 255),
        "4": (255, 220, 0),
    }
