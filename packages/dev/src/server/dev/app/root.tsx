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

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        <title>Effing</title>
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "white",
        }}
      >
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <script dangerouslySetInnerHTML={{ __html: RELOAD_SCRIPT }} />
      </body>
    </html>
  );
}
