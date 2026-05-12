---
"@effing/dev": minor
"@effing/create": minor
---

Add `effing url` command for minting signed fn URLs

The new `effing url <kind> <id>` CLI prints a signed fn URL for the given props, reading `BASE_URL` and `SECRET_KEY` from the project's `.env`. Useful for agents or `curl` fetching a specific propped variant from the dev or production server without going through the HTML preview pages. Width and height default to the first entry in `dev.resolutions`. The starter template wires it up as `npm run url`.
