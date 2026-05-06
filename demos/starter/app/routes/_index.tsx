import { Link, useLoaderData } from "react-router";
import { ensureFnRuntime } from "~/fn.server";
import { fnModuleIds } from "@effing/fn";

export async function loader() {
  ensureFnRuntime();
  return {
    imageIds: fnModuleIds("image"),
    annieIds: fnModuleIds("annie"),
    effieIds: fnModuleIds("effie"),
  };
}

export default function Index() {
  const { imageIds, annieIds, effieIds } = useLoaderData<typeof loader>();

  return (
    <div style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Effing Overview</h1>
      <p style={{ color: "#666", fontSize: 18 }}>
        Index of every image, annie, and effie in this project.
      </p>

      <section style={{ marginTop: "2rem" }}>
        <h2>Images</h2>
        <p style={{ color: "#666" }}>Single images rendered as PNG or JPEG.</p>
        {imageIds.length === 0 ? (
          <p>
            No images found. Create one at <code>app/images/*.fn.tsx</code>
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {imageIds.map((id) => (
              <li key={id} style={{ marginBottom: 8 }}>
                <Link
                  to={`/preview/image/${id}`}
                  style={{
                    display: "inline-block",
                    padding: "8px 16px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: 4,
                    textDecoration: "none",
                    color: "#333",
                  }}
                >
                  {id} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Annies</h2>
        <p style={{ color: "#666" }}>
          Frame-by-frame animations rendered as TAR archives of PNG/JPEG frames.
        </p>
        {annieIds.length === 0 ? (
          <p>
            No annies found. Create one at <code>app/annies/*.fn.tsx</code>
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {annieIds.map((id) => (
              <li key={id} style={{ marginBottom: 8 }}>
                <Link
                  to={`/preview/annie/${id}`}
                  style={{
                    display: "inline-block",
                    padding: "8px 16px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: 4,
                    textDecoration: "none",
                    color: "#333",
                  }}
                >
                  {id} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Effies</h2>
        <p style={{ color: "#666" }}>
          Video compositions defined as JSON, rendered by FFS (FFmpeg Service).
        </p>
        {effieIds.length === 0 ? (
          <p>
            No effies found. Create one at <code>app/effies/*.fn.tsx</code>
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {effieIds.map((id) => (
              <li key={id} style={{ marginBottom: 8 }}>
                <Link
                  to={`/preview/effie/${id}`}
                  style={{
                    display: "inline-block",
                    padding: "8px 16px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: 4,
                    textDecoration: "none",
                    color: "#333",
                  }}
                >
                  {id} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
