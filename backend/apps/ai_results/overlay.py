from __future__ import annotations

from dataclasses import dataclass

from apps.ai_results.model_contract import DISEASE_CLASSES
from apps.ai_results.result_types import FindingDecision, ToothDecision


QUADRANT_COLORS = {
    "1": (0, 230, 130),
    "2": (255, 75, 45),
    "3": (0, 190, 255),
    "4": (255, 220, 0),
}
REVIEW_COLOR = (255, 165, 0)
NOTICE_LINES = (
    "Research only - not clinical diagnosis",
    "Scores are uncalibrated model scores",
)


@dataclass(frozen=True)
class OverlayFinding:
    flagged_diseases: tuple[str, ...]
    is_review: bool


@dataclass(frozen=True)
class OverlayScale:
    font_scale: float
    text_thickness: int
    box_thickness: int
    line_height: int
    margin: int


def fdi_parts(value: str) -> tuple[str, str]:
    fdi = str(value).removesuffix(".0").strip()
    if len(fdi) == 2 and fdi.isdigit():
        return fdi[0], fdi[1]
    return "?", fdi or "?"


def select_overlay_finding(tooth: ToothDecision) -> OverlayFinding:
    decisions = {item.disease_label: item for item in tooth.decisions}
    flagged = [label for label in DISEASE_CLASSES if decisions[label].is_positive]
    if "Deep Caries" in flagged and "Any Caries" in flagged:
        flagged.remove("Any Caries")
    is_review = not flagged and decisions["Any Caries"].decision == FindingDecision.REVIEW
    return OverlayFinding(flagged_diseases=tuple(flagged), is_review=is_review)


def overlay_scale(image_height: int, image_width: int) -> OverlayScale:
    font_scale = max(0.75, min(1.15, image_width / 2500.0))
    text_thickness = max(2, round(font_scale * 2))
    box_thickness = max(3, round(min(image_height, image_width) / 450))
    line_height = max(28, round(34 * font_scale))
    margin = max(8, box_thickness * 2)
    return OverlayScale(
        font_scale=font_scale,
        text_thickness=text_thickness,
        box_thickness=box_thickness,
        line_height=line_height,
        margin=margin,
    )


def preferred_label_top(
    *,
    quadrant: str,
    bbox_y1: int,
    bbox_y2: int,
    block_height: int,
    margin: int,
) -> int:
    if quadrant in {"3", "4"}:
        return bbox_y2 + margin
    return bbox_y1 - block_height - margin


def _clip(value: int, lower: int, upper: int) -> int:
    return max(lower, min(value, upper))


def _finding_lines(tooth: ToothDecision, finding: OverlayFinding) -> list[str]:
    quadrant, tooth_number = fdi_parts(tooth.tooth.fdi_tooth_id)
    score_map = tooth.scores.to_json()
    lines = [f"Q={quadrant}", f"N={tooth_number}"]
    if finding.is_review:
        lines.extend(["D=Any Caries REVIEW", f"S={score_map['Any Caries']:.0%}"])
    else:
        for index, disease in enumerate(finding.flagged_diseases):
            prefix = "D=" if index == 0 else "  "
            lines.append(f"{prefix}{disease} {score_map[disease]:.0%}")
    return lines


def _draw_outlined_text(canvas, text, origin, color, scale: OverlayScale, cv2_module) -> None:
    cv2_module.putText(
        canvas,
        text,
        origin,
        cv2_module.FONT_HERSHEY_SIMPLEX,
        scale.font_scale,
        (0, 0, 0),
        scale.text_thickness + 3,
        cv2_module.LINE_AA,
    )
    cv2_module.putText(
        canvas,
        text,
        origin,
        cv2_module.FONT_HERSHEY_SIMPLEX,
        scale.font_scale,
        color,
        scale.text_thickness,
        cv2_module.LINE_AA,
    )


def render_overlay_png(image_rgb, teeth: tuple[ToothDecision, ...], *, cv2_module) -> bytes:
    canvas = image_rgb.copy()
    image_height, image_width = canvas.shape[:2]
    scale = overlay_scale(image_height, image_width)

    for tooth in teeth:
        finding = select_overlay_finding(tooth)
        if not finding.flagged_diseases and not finding.is_review:
            continue

        x1, y1, x2, y2 = [round(value) for value in tooth.tooth.bbox_xyxy]
        x1 = _clip(x1, 0, image_width - 1)
        x2 = _clip(x2, 0, image_width - 1)
        y1 = _clip(y1, 0, image_height - 1)
        y2 = _clip(y2, 0, image_height - 1)

        quadrant, _ = fdi_parts(tooth.tooth.fdi_tooth_id)
        color = REVIEW_COLOR if finding.is_review else QUADRANT_COLORS.get(quadrant, (255, 255, 255))
        lines = _finding_lines(tooth, finding)

        cv2_module.rectangle(canvas, (x1, y1), (x2, y2), color, scale.box_thickness)
        text_widths = [
            cv2_module.getTextSize(
                line,
                cv2_module.FONT_HERSHEY_SIMPLEX,
                scale.font_scale,
                scale.text_thickness,
            )[0][0]
            for line in lines
        ]
        block_width = max(text_widths, default=0)
        block_height = scale.line_height * len(lines)
        label_x = _clip(x1, scale.margin, max(scale.margin, image_width - block_width - scale.margin))
        max_label_top = max(scale.margin, image_height - block_height - scale.margin)
        preferred_top = preferred_label_top(
            quadrant=quadrant,
            bbox_y1=y1,
            bbox_y2=y2,
            block_height=block_height,
            margin=scale.margin,
        )
        label_top = _clip(preferred_top, scale.margin, max_label_top)

        for line_index, line in enumerate(lines):
            baseline_y = label_top + (line_index + 1) * scale.line_height
            _draw_outlined_text(canvas, line, (label_x, baseline_y), color, scale, cv2_module)

    notice_scale = max(0.65, min(0.90, image_width / 3200.0))
    notice_style = OverlayScale(
        font_scale=notice_scale,
        text_thickness=2,
        box_thickness=scale.box_thickness,
        line_height=scale.line_height,
        margin=scale.margin,
    )
    _draw_outlined_text(canvas, NOTICE_LINES[0], (20, 38), (255, 255, 255), notice_style, cv2_module)
    second_notice_y = 38 + max(26, round(32 * notice_scale))
    _draw_outlined_text(
        canvas,
        NOTICE_LINES[1],
        (20, second_notice_y),
        (255, 255, 255),
        notice_style,
        cv2_module,
    )

    overlay_bgr = cv2_module.cvtColor(canvas, cv2_module.COLOR_RGB2BGR)
    encoded, png_buffer = cv2_module.imencode(".png", overlay_bgr)
    if not encoded:
        raise ValueError("Overlay PNG encoding failed.")
    return bytes(png_buffer.tobytes())
