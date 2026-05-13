import { useLoaderData } from "react-router";
import { fnModuleIds } from "@effing/fn";
import { ensureFnRuntime } from "../fn.server";
import { getProjectName } from "../project.server";
import { Header } from "../components/Header";

export type IndexData = {
  projectName: string;
  imageIds: string[];
  annieIds: string[];
  effieIds: string[];
};

export async function loader(): Promise<IndexData> {
  ensureFnRuntime();
  return {
    projectName: getProjectName(),
    imageIds: fnModuleIds("image"),
    annieIds: fnModuleIds("annie"),
    effieIds: fnModuleIds("effie"),
  };
}

export default function Index() {
  const data = useLoaderData() as IndexData;

  return (
    <>
      <Header projectName={data.projectName} />
      <main
        style={{
          padding: "2.5rem 2rem 4rem",
          maxWidth: 1080,
          display: "flex",
          flexDirection: "column",
          gap: "2.5rem",
        }}
      >
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
          description="Video compositions defined as JSON, to be rendered by FFS (FFmpeg Service)."
          path="effie"
          ids={data.effieIds}
          empty="No effies found. Create one at app/effies/*.fn.tsx"
        />
      </main>
    </>
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
    <section>
      <h2
        style={{
          margin: 0,
          fontSize: "1.25rem",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: "0.25rem 0 1rem",
          color: "var(--color-coal-light-2)",
        }}
      >
        {description}
      </p>
      {ids.length === 0 ? (
        <p
          style={{
            margin: 0,
            padding: "0.875rem 1rem",
            backgroundColor: "var(--color-coal-light-6)",
            border: "1px dashed var(--color-coal-light-4)",
            borderRadius: 6,
            color: "var(--color-coal-light-2)",
          }}
        >
          <code style={{ fontSize: "0.85rem" }}>{empty}</code>
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          {ids.map((id) => (
            <li key={id}>
              <a
                href={`/preview/${path}/${id}`}
                className="fn-tile"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0.875rem",
                  backgroundColor: "var(--color-snow)",
                  border: "1px solid var(--color-coal-light-5)",
                  borderRadius: 6,
                  color: "var(--color-coal)",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                {id}
                <span
                  aria-hidden="true"
                  className="fn-tile-arrow"
                  style={{ color: "var(--color-salad)" }}
                >
                  →
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
