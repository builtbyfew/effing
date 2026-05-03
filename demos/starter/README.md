# Effing project `starter`

A React Router app for creating Effing Images, Effing Annies, and Effing Effies with the `@effing/*` packages.

- **Effing Images** — single-frame stills. Useful for slideshow covers, thumbnails, social cards, or any composed graphic.
- **Effing Annies** — frame-based animations, streamed as TAR archives of PNG/JPEG frames. Useful for typewriter text, photo zooms, Ken Burns effects, animated overlays.
- **Effing Effies** — video compositions that assemble images, annies, audio, and effects into an MP4.

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

(`pnpm` and `yarn` work the same — substitute as you prefer.)

Open [http://localhost:3839](http://localhost:3839) — the homepage lists every image, annie, and effie in the project with links to their preview pages.

`npm run dev` also runs a local FFS rendering service alongside the app, so the "Render it FFS" button on effie previews works out of the box.

## Learn more

See [`GUIDE.md`](./GUIDE.md) for project structure, how to write images, annies, and effies, fonts, environment variables, scripts, and deployment.
