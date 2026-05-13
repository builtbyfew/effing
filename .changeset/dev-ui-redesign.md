---
"@effing/dev": minor
---

Redesign dev server UI with sticky breadcrumb header

Adds a Nunito Sans typeface and the salad/coal/tomato design system. The
sticky header carries a breadcrumb — effing logo / project / kind / fn id /
resolution dropdown — that replaces the per-page title block, with the
resolution picker and render-scale dropdown sharing a reusable Select. The
overview moves to /preview (with / redirecting), and the project name from
effing.config.ts is plumbed through to the UI.
