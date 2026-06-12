---
"@effing/canvas": patch
---

Honor gradientUnits="userSpaceOnUse" on SVG gradients

Gradient coordinates were always interpreted as objectBoundingBox fractions,
so gradients with userSpaceOnUse units (as emitted by Figma and Illustrator
exports) clamped to the first stop and rendered as a flat color. Linear and
radial gradients now use user-space coordinates directly for both fills and
strokes, with percentages resolved against the viewport per the SVG spec.
