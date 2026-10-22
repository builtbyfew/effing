---
"@effing/canvas": patch
---

Draw rounded borders of unequal widths inside the box, as browsers do

A border with rounded corners whose sides weren't all the same width or colour, such as a coloured `borderLeft` on a card with `borderRadius`, was stroked as a band of constant width: it overflowed the box by half its width along the adjacent edges, and kept its full width round the corners. Borders are now filled between the border box and the padding box, whose corner radii are the border box's less the adjoining widths on each axis, so a left-only border tapers to nothing where it meets the top and bottom edges. Sides of different colours meet along the line from the border box's corner to the padding box's.
