import { useLoaderData } from "react-router";
import { fnModuleIds } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";

export type IndexData = {
  imageIds: string[];
  annieIds: string[];
  effieIds: string[];
};

export async function loader(): Promise<IndexData> {
  ensureFnRuntime();
  return {
    imageIds: fnModuleIds("image"),
    annieIds: fnModuleIds("annie"),
    effieIds: fnModuleIds("effie"),
  };
}

export default function Index() {
  const data = useLoaderData() as IndexData;

  return (
    <div style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Effing Overview</h1>
      <p style={{ color: "#666", fontSize: 18 }}>
        Index of every image, annie, and effie in this project.
      </p>

      <Section
        title="Images"
        description="Single images rendered as PNG or JPEG."
        path="image"
        ids={data.imageIds}
        empty="No images found. Create one at app/images/*.fn.tsx"
      />
      <Section
        title="Annies"
        description="Frame-by-frame animations rendered as TAR archives of PNG/JPEG frames."
        path="annie"
        ids={data.annieIds}
        empty="No annies found. Create one at app/annies/*.fn.tsx"
      />
      <Section
        title="Effies"
        description="Video compositions defined as JSON, rendered by FFS (FFmpeg Service)."
        path="effie"
        ids={data.effieIds}
        empty="No effies found. Create one at app/effies/*.fn.tsx"
      />
    </div>
  );
}

function Section({
  title,
  description,
  path,
  ids,
  empty,
}: {
  title: string;
  description: string;
  path: string;
  ids: string[];
  empty: string;
}) {
  return (
    <section style={{ marginTop: "2rem" }}>
      <h2>{title}</h2>
      <p style={{ color: "#666" }}>{description}</p>
      {ids.length === 0 ? (
        <p>
          <code>{empty}</code>
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {ids.map((id) => (
            <li key={id} style={{ marginBottom: 8 }}>
              <a
                href={`/preview/${path}/${id}`}
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
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
