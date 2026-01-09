import { Link, useLoaderData } from "react-router";
import { getAnnieIds } from "~/annies";
import { getEffieIds } from "~/effies";

export async function loader() {
  return {
    annieIds: getAnnieIds(),
    effieIds: getEffieIds(),
  };
}

export default function Index() {
  const { annieIds, effieIds } = useLoaderData<typeof loader>();

  return (
    <div style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Effing Starter</h1>
      <p style={{ color: "#666", fontSize: 18 }}>
        A starter project for developing annies and effies using the @effing/*
        packages.
      </p>

      <section style={{ marginTop: "2rem" }}>
        <h2>Annies</h2>
        <p style={{ color: "#666" }}>
          Frame-by-frame animations rendered as TAR archives of PNG/JPEG frames.
        </p>
        {annieIds.length === 0 ? (
          <p>
            No annies found. Create one at <code>app/annies/*.annie.tsx</code>
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {annieIds.map((id) => (
              <li key={id} style={{ marginBottom: 8 }}>
                <Link
                  to={`/pan/${id}`}
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
            No effies found. Create one at <code>app/effies/*.effie.tsx</code>
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {effieIds.map((id) => (
              <li key={id} style={{ marginBottom: 8 }}>
                <Link
                  to={`/pff/${id}`}
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
