import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

// Reload the page when the dev server's SSE channel emits "reload" — fires
// on user fn file edits. Self-healing if the connection drops.
const RELOAD_SCRIPT = `
(function(){
  if (typeof EventSource === "undefined") return;
  function connect() {
    var es = new EventSource("/__effing/reload");
    es.addEventListener("reload", function(){ location.reload(); });
    es.onerror = function(){ es.close(); setTimeout(connect, 1000); };
  }
  connect();
})();
`;

const DESIGN_TOKENS_CSS = `
:root {
  --font-sans: "Nunito Sans", system-ui, -apple-system, sans-serif;
  --header-h: 44px;

  --color-salad: #4cae4c;
  --color-salad-light-1: #74bf72;
  --color-salad-light-2: #98cf95;
  --color-salad-light-3: #bbdfb8;
  --color-salad-light-4: #ddefdb;
  --color-salad-light-5: #eef7ed;
  --color-salad-light-6: #f6fbf6;
  --color-salad-light-7: #fdfefd;
  --color-salad-dark-1: #368036;
  --color-salad-dark-2: #225522;
  --color-salad-dark-3: #0f2e0f;
  --color-salad-dark-4: #020b02;
  --color-salad-dark-5: #000100;

  --color-tomato: #ff6347;
  --color-tomato-light-1: #ff876e;
  --color-tomato-light-2: #ffa793;
  --color-tomato-light-3: #ffc5b7;
  --color-tomato-light-4: #ffe2db;
  --color-tomato-light-5: #fff1ed;
  --color-tomato-light-6: #fff8f6;
  --color-tomato-light-7: #fffefd;
  --color-tomato-dark-1: #be4732;
  --color-tomato-dark-2: #802e1f;
  --color-tomato-dark-3: #48160d;
  --color-tomato-dark-4: #160302;
  --color-tomato-dark-5: #030000;

  --color-coal: #151716;
  --color-coal-light-1: #3f3d3d;
  --color-coal-light-2: #6a6969;
  --color-coal-light-3: #999898;
  --color-coal-light-4: #cbcaca;
  --color-coal-light-5: #e5e4e4;
  --color-coal-light-6: #f2f2f2;
  --color-coal-light-7: #fcfcfc;

  --color-snow: #ffffff;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
}

html { scroll-padding-top: var(--header-h); }

.header-link,
.header-link:hover {
  text-decoration: none;
}
.header-link {
  transition: color 120ms ease;
}
.header-link:hover {
  color: var(--color-salad-dark-1);
}

.fn-tile,
.fn-tile:hover {
  text-decoration: none;
}
.fn-tile {
  transition: border-color 120ms ease, background-color 120ms ease;
}
.fn-tile:hover {
  border-color: var(--color-salad);
  background-color: var(--color-salad-light-6);
}
.fn-tile:hover .fn-tile-arrow {
  transform: translateX(2px);
}
.fn-tile-arrow {
  transition: transform 120ms ease;
}

body {
  font-family: var(--font-sans);
  color: var(--color-coal);
  background-color: var(--color-coal-light-7);
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--color-salad-dark-1);
  text-decoration: none;
}
a:hover { text-decoration: underline; }

h1, h2, h3, h4 {
  font-family: var(--font-sans);
  color: var(--color-coal);
  letter-spacing: -0.01em;
}
h1 { font-weight: 700; }
h2, h3 { font-weight: 600; }

code, pre {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
`;

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700;800&display=swap"
        />
        <Meta />
        <Links />
        <style dangerouslySetInnerHTML={{ __html: DESIGN_TOKENS_CSS }} />
        <title>Effing</title>
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <script dangerouslySetInnerHTML={{ __html: RELOAD_SCRIPT }} />
      </body>
    </html>
  );
}
