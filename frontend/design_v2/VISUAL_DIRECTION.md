# Visual Direction v2

## Personality and hierarchy

Pearlix is precise, clinical, trustworthy, and operational—not a generic admin template. Canvas uses cool blue-gray; content uses composed surfaces with 16 px radius, 1 px borders, and only low elevation for major containers. Cards contain a header, useful body, metadata, and intentional action area; do not create a giant empty card around a short form or list.

Page order is breadcrumb/context, 32/40 title, one user-facing sentence, one primary action, priority information/filtering, work area, then secondary detail. Use 20/28 section headings, 16/24 card headings, 14/22 body, 13/18 labels, 12/18 metadata, and 30–36 px KPI values. Use `Inter, ui-sans-serif, system-ui, sans-serif`, tabular numerals for money/schedules, and the 4/8/12/16/20/24/32/40/48/64 px scale.

## Color and depth

Foundation is navy/teal, with blue reserved for links/active selection and violet only for AI. The palette has contrast-tested text, border, hover, focus, and semantic pairs in `TOKENS_V2.md`; status always has an icon/text label in addition to color. No neon, pure black/white extremes, rainbow status grids, or color-only information. Active navigation is visibly stronger than hover; KPI icon tiles use controlled tinted surfaces.

## Density rules

- Page padding: 32 px (1440), 24 px (1280/1024), 16 px (768); primary sections: 24–32 px apart; independent list cards: 24 px apart.
- Major card padding: 24 px desktop / 20 px tablet. Table toolbar: 16 px; data rows: 14–16 px vertical, never a loose borderless list.
- Desktop forms use a max 1200 px work area and two columns only for paired short fields; every long form has section headers and a sticky save/cancel bar.
- Empty content stays compact: icon, title, one sentence, and one authorized action—not a tall blank panel.

## Theme and language

Dark is a tokenized surface system, not inversion. EN/AR changes translation dictionary, document language/direction, persistent preference, shell placement, directional icons, truncation, numeric/date/currency alignment, and mixed-script isolation. Static UI must be translated; backend text remains as returned unless an approved mapping exists.
