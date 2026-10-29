---
"@effing/create": patch
---

The starter now depends on `effing-cloud` ^0.8.0 (was ^0.5.0), and its GUIDE.md covers deploying from CI and scripts: setting `EFFING_CLOUD_API_KEY` to a console API key limited to the project, checking it with `effing-cloud whoami`, and reading `effing-cloud deploy --json` and `urls --json` output.
