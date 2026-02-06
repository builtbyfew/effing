---
"@effing/ffs": minor
---

Support `PORT` env var fallback and backend API keys

- `PORT` is now used as fallback when `FFS_PORT` is not set (precedence: `FFS_PORT` > `PORT` > `2000`), improving compatibility with hosting platforms like Railway, Render, and Heroku
- New `FFS_WARMUP_BACKEND_API_KEY` and `FFS_RENDER_BACKEND_API_KEY` environment variables for authenticating to backends when using backend separation
