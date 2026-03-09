/**
 * Visual comparison tests between @effing/canvas and satori+resvg.
 *
 * These tests render the same JSX fixtures with both pipelines
 * and compare the output PNGs using pixelmatch.
 *
 * Run with: pnpm test:comparison
 *
 * Note: These tests require @napi-rs/canvas to be installed as a
 * peer dependency with native binaries available. They are skipped
 * in CI environments without native dependencies.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, it, expect } from "vitest";
import React from "react";

import type { FontData } from "../../types.ts";

// ---------------------------------------------------------------------------
// Native dependency guard
// ---------------------------------------------------------------------------

const HAS_NATIVE_DEPS = (() => {
  try {
    require.resolve("@napi-rs/canvas");
    return true;
  } catch {
    return false;
  }
})();

// ---------------------------------------------------------------------------
// Font fetching (Inter from Google Fonts — OFL licensed)
// ---------------------------------------------------------------------------

const GOOGLE_FONTS = "https://fonts.gstatic.com/s";
const fontCache = new Map<string, Promise<Buffer>>();

function fetchFont(url: string): Promise<Buffer> {
  let p = fontCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch font: ${url}`);
      return r.arrayBuffer().then((ab) => Buffer.from(ab));
    });
    fontCache.set(url, p);
  }
  return p;
}

async function loadFonts(): Promise<FontData[]> {
  return Promise.all([
    fetchFont(
      `${GOOGLE_FONTS}/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf`,
    ).then((data) => ({
      name: "Inter",
      data,
      weight: 400 as const,
      style: "normal" as const,
    })),
    fetchFont(
      `${GOOGLE_FONTS}/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf`,
    ).then((data) => ({
      name: "Inter",
      data,
      weight: 700 as const,
      style: "normal" as const,
    })),
    fetchFont(
      `${GOOGLE_FONTS}/inter/v20/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dthjQ.ttf`,
    ).then((data) => ({
      name: "Inter",
      data,
      weight: 400 as const,
      style: "italic" as const,
    })),
  ]);
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

async function renderWithCanvas(
  element: React.ReactNode,
  width: number,
  height: number,
  fonts: FontData[],
  emoji?: import("../../jsx/emoji.ts").EmojiStyle,
): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const { renderReactElement } = await import("../../jsx/index.ts");
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  await renderReactElement(ctx, element, { fonts, emoji });
  return Buffer.from(canvas.encodeSync("png"));
}

async function renderWithSatori(
  element: React.ReactNode,
  width: number,
  height: number,
  fonts: FontData[],
  emoji?: import("../../jsx/emoji.ts").EmojiStyle,
): Promise<Buffer> {
  const satori = (await import("satori")).default;
  const { Resvg } = await import("@resvg/resvg-js");
  const opts: Parameters<typeof satori>[1] = { width, height, fonts };
  if (emoji) {
    const { makeLoadAdditionalAsset } =
      await import("../../../../satori/src/emoji.ts");
    opts.loadAdditionalAsset = makeLoadAdditionalAsset(emoji);
  }
  const svg = await satori(element, opts);
  const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });
  return Buffer.from(resvg.render().asPng());
}

async function compareImages(
  canvasPng: Buffer,
  satoriPng: Buffer,
  label: string,
  threshold = 0.1,
) {
  const pixelmatch = (await import("pixelmatch")).default;
  const { PNG } = await import("pngjs");

  const img1 = PNG.sync.read(canvasPng);
  const img2 = PNG.sync.read(satoriPng);

  const { width, height } = img1;
  const debug = !!process.env.COMPARISON_DEBUG;
  const diff = debug ? new PNG({ width, height }) : null;

  const diffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff?.data ?? null,
    width,
    height,
    { threshold },
  );

  const totalPixels = width * height;
  const percentage = (diffPixels / totalPixels) * 100;

  if (debug && diff) {
    const debugDir = join(tmpdir(), "effing-comparison-debug");
    mkdirSync(debugDir, { recursive: true });
    const slug = label.replace(/\s+/g, "-").toLowerCase();
    writeFileSync(join(debugDir, `${slug}-canvas.png`), canvasPng);
    writeFileSync(join(debugDir, `${slug}-satori.png`), satoriPng);
    writeFileSync(join(debugDir, `${slug}-diff.png`), PNG.sync.write(diff));
    console.log(
      `${label}: ${percentage.toFixed(2)}% diff (${diffPixels}/${totalPixels}) — ${debugDir}/${slug}-*.png`,
    );
  }

  return { diffPixels, totalPixels, percentage };
}

// ---------------------------------------------------------------------------
// Test image generator (tiny PNG via pngjs)
// ---------------------------------------------------------------------------

async function makeTestImage(w: number, h: number): Promise<string> {
  const { PNG } = await import("pngjs");
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      png.data[i] = Math.floor((x / w) * 255); // R gradient
      png.data[i + 1] = Math.floor((y / h) * 255); // G gradient
      png.data[i + 2] = 128; // B constant
      png.data[i + 3] = 255; // A opaque
    }
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

// ---------------------------------------------------------------------------
// PropertyCard component
// ---------------------------------------------------------------------------

interface PropertyCardProps {
  width: number;
  height: number;
  address: string;
  price: string;
  status: "NEW" | "SOLD";
  beds: number;
  baths: number;
  sqft: string;
  features: string[];
}

function PropertyCard({
  width,
  height,
  address,
  price,
  status,
  beds,
  baths,
  sqft,
  features,
}: PropertyCardProps) {
  const statusColor = status === "NEW" ? "#16A34A" : "#DC2626";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        fontFamily: "Inter",
        backgroundColor: "#FFFFFF",
        border: "2px solid #E5E7EB",
        borderRadius: 12,
        padding: 20,
      }}
    >
      {/* Header: status badge + price */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 11,
            fontWeight: 700,
            color: "#FFFFFF",
            backgroundColor: statusColor,
            borderRadius: 4,
            padding: "2px 8px",
            textTransform: "uppercase" as const,
            letterSpacing: 2,
          }}
        >
          {status}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          {price}
        </div>
      </div>

      {/* Address (truncated) */}
      <div
        style={{
          display: "flex",
          fontSize: 14,
          color: "#374151",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {address}
      </div>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 1,
          backgroundColor: "#D1D5DB",
          opacity: 0.5,
          marginTop: 12,
          marginBottom: 12,
        }}
      />

      {/* Stats row: beds | baths | sqft — equal columns with vertical borders */}
      <div style={{ display: "flex", marginBottom: 12 }}>
        {[
          { label: "Beds", value: `${beds}` },
          { label: "Baths", value: `${baths}` },
          { label: "Sqft", value: sqft },
        ].map((stat, i) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flexGrow: 1,
              borderLeftWidth: i > 0 ? 1 : 0,
              borderLeftStyle: "solid",
              borderLeftColor: "#E5E7EB",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 11,
                color: "#6B7280",
                textTransform: "uppercase" as const,
                letterSpacing: 1,
                marginBottom: 2,
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Feature tags (wrapping pills) */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          flexGrow: 1,
          alignContent: "flex-start",
        }}
      >
        {features.map((f) => (
          <div
            key={f}
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#F3F4F6",
              borderRadius: 16,
              padding: "2px 10px",
              fontSize: 12,
              color: "#374151",
            }}
          >
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PricingCard component
// ---------------------------------------------------------------------------

interface PricingCardProps {
  width: number;
  height: number;
  planName: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  features: string[];
  highlighted?: boolean;
}

function PricingCard({
  width,
  height,
  planName,
  monthlyPrice,
  yearlyPrice,
  features,
  highlighted = false,
}: PricingCardProps) {
  const accentColor = highlighted ? "#6366F1" : "#9CA3AF";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        fontFamily: "Inter",
        backgroundColor: "#FFFFFF",
        border: `2px solid ${accentColor}`,
        borderRadius: 12,
        padding: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 11,
            fontWeight: 400,
            color: accentColor,
            textTransform: "uppercase" as const,
            letterSpacing: 2,
            marginBottom: 4,
          }}
        >
          {planName}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>
            {`$${monthlyPrice}`}
          </span>
          <span style={{ fontSize: 13, color: "#6B7280", marginLeft: 4 }}>
            /mo
          </span>
        </div>
        {yearlyPrice != null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "#9CA3AF",
                textDecoration: "line-through",
              }}
            >
              {`$${monthlyPrice * 12}/yr`}
            </span>
            <span
              style={{ fontSize: 12, fontStyle: "italic", color: "#10B981" }}
            >
              Save 20%
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 1,
          backgroundColor: highlighted ? "#6366F1" : "#D1D5DB",
          opacity: 0.5,
        }}
      />

      {/* Features */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 16,
          flexGrow: 1,
        }}
      >
        {features.map((f) => (
          <div
            key={f}
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 13,
              color: "#374151",
            }}
          >
            <span style={{ color: accentColor, marginRight: 8, fontSize: 14 }}>
              ✓
            </span>
            {f}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: 16,
          padding: "10px 0",
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 14,
          color: highlighted ? "#FFFFFF" : accentColor,
          backgroundColor: highlighted ? "#6366F1" : "#F3F4F6",
        }}
      >
        <div style={{ display: "flex" }}>Get Started</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TagCloud component
// ---------------------------------------------------------------------------

interface TagCloudProps {
  width: number;
  height: number;
  tags: string[];
}

function TagCloud({ width, height, tags }: TagCloudProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        width,
        height,
        fontFamily: "Inter",
        backgroundColor: "#FFFFFF",
        padding: 16,
        gap: 6,
        alignContent: "flex-start",
      }}
    >
      {tags.map((tag) => (
        <div
          key={tag}
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "#A5B4FC",
            borderRadius: 16,
            padding: "4px 12px",
            fontSize: 13,
            color: "#1E1B4B",
            maxWidth: 150,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tag}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatsBar component
// ---------------------------------------------------------------------------

interface StatItem {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

interface StatsBarProps {
  width: number;
  height: number;
  stats: StatItem[];
}

function StatsBar({ width, height, stats }: StatsBarProps) {
  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        fontFamily: "Inter",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        alignItems: "stretch",
      }}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            flexGrow: 1,
            padding: "12px 8px",
            borderLeftWidth: i > 0 ? 1 : 0,
            borderLeftStyle: "solid",
            borderLeftColor: "#E5E7EB",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 11,
              color: "#6B7280",
              textTransform: "uppercase" as const,
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            {stat.label}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {stat.value}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 12,
              fontWeight: 700,
              color: stat.positive ? "#10B981" : "#EF4444",
              marginTop: 4,
              transform: "rotate(-2deg)",
            }}
          >
            {stat.change}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListingOverlayCard — absolute positioning, gradients, filter, radii
// ---------------------------------------------------------------------------

interface ListingOverlayCardProps {
  width: number;
  height: number;
}

function ListingOverlayCard({ width, height }: ListingOverlayCardProps) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        fontFamily: "Inter",
        overflow: "hidden",
        borderRadius: 12,
        backgroundColor: "#4A5568",
      }}
    >
      {/* Dimmed overlay (tests filter on a div) */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "#2D3748",
          filter: "brightness(0.8)",
        }}
      />

      {/* Gradient scrim at bottom */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
          height: "50%",
          backgroundImage:
            "linear-gradient(to bottom, transparent, rgba(0,0,0,0.7))",
        }}
      />

      {/* Price badge — asymmetric radii, top-left */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 12,
          left: 0,
          backgroundColor: "#16A34A",
          color: "white",
          fontSize: 14,
          fontWeight: 700,
          padding: "4px 12px",
          borderTopRightRadius: 8,
          borderBottomRightRadius: 8,
        }}
      >
        $425,000
      </div>

      {/* Status pill — hex alpha bg, top-right */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 12,
          right: 12,
          backgroundColor: "#FFFFFFCC",
          color: "#111827",
          fontSize: 11,
          fontWeight: 700,
          padding: "2px 10px",
          borderRadius: 16,
          textAlign: "center" as const,
        }}
      >
        NEW
      </div>

      {/* Bottom caption */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          bottom: 12,
          left: 12,
          right: 12,
          alignSelf: "flex-end",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "white",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          1234 NW Evergreen Terrace
        </div>
        <div
          style={{
            display: "flex",
            color: "#FFFFFFCC",
            fontSize: 12,
            marginTop: 2,
          }}
        >
          Springfield, OR 97403
        </div>
      </div>

      {/* Small accent box — tests individual corner radii */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: 12,
          right: 12,
          width: 40,
          height: 40,
          backgroundColor: "white",
          borderTopLeftRadius: 12,
          borderTopRightRadius: 4,
          borderBottomRightRadius: 12,
          borderBottomLeftRadius: 4,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 16,
            color: "#111827",
            fontWeight: 700,
          }}
        >
          A
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GradientHeroCard — gradients with angles, flexBasis, scale/translate
// ---------------------------------------------------------------------------

interface GradientHeroCardProps {
  width: number;
  height: number;
}

function GradientHeroCard({ width, height }: GradientHeroCardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        fontFamily: "Inter",
        backgroundImage: "linear-gradient(135deg, #667EEA, #764BA2)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Top section — flexBasis */}
      <div
        style={{
          display: "flex",
          flexBasis: "30%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Decorative scaled circle */}
        <div
          style={{
            display: "flex",
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.3)",
            transform: "scale(1.2)",
          }}
        />
      </div>

      {/* Middle section — title with tight lineHeight */}
      <div
        style={{
          display: "flex",
          flexBasis: "40%",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 700,
            color: "white",
            textAlign: "center" as const,
            lineHeight: 0.85,
          }}
        >
          Build Something Amazing
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 13,
            color: "rgba(255,255,255,0.8)",
            marginTop: 8,
            textAlign: "center" as const,
          }}
        >
          Start your project today
        </div>
      </div>

      {/* Bottom section — CTA with gradient bg and translateY */}
      <div
        style={{
          display: "flex",
          flexBasis: "30%",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            backgroundImage: "linear-gradient(to right, #F59E0B, #EF4444)",
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            padding: "10px 28px",
            borderRadius: 24,
            transform: "translateY(-4px)",
          }}
        >
          Get Started
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JobPostCard — wordBreak, boxShadow, lineHeight, alignSelf
// ---------------------------------------------------------------------------

interface JobPostCardProps {
  width: number;
  height: number;
}

function JobPostCard({ width, height }: JobPostCardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        fontFamily: "Inter",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #E5E7EB",
      }}
    >
      {/* Decorative bar — alignSelf center */}
      <div
        style={{
          display: "flex",
          width: 60,
          height: 4,
          backgroundColor: "#6366F1",
          borderRadius: 2,
          alignSelf: "center",
          marginBottom: 16,
        }}
      />

      {/* Job title — break-all, tight lineHeight */}
      <div
        style={{
          display: "flex",
          flexBasis: "35%",
          fontSize: 22,
          fontWeight: 700,
          color: "#111827",
          lineHeight: 0.9,
          wordBreak: "break-all" as const,
          textAlign: "center" as const,
        }}
      >
        SeniorFullStackDevelopmentEngineer
      </div>

      {/* Company info */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 12,
          flexGrow: 1,
        }}
      >
        <div style={{ display: "flex", fontSize: 14, color: "#6B7280" }}>
          Acme Corp
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 12,
            color: "#9CA3AF",
            marginTop: 4,
          }}
        >
          Brussels, Belgium
        </div>
      </div>

      {/* CTA — boxShadow, alignSelf flex-end */}
      <div
        style={{
          display: "flex",
          alignSelf: "flex-end",
          backgroundColor: "#6366F1",
          color: "#FFFFFFCC",
          fontWeight: 700,
          fontSize: 13,
          padding: "8px 20px",
          borderRadius: 8,
          boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
        }}
      >
        Apply Now
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricsDashboard — negative margins, maxWidth/maxHeight, pre-wrap, underline
// ---------------------------------------------------------------------------

interface MetricsDashboardProps {
  width: number;
  height: number;
}

function MetricsDashboard({ width, height }: MetricsDashboardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        fontFamily: "Inter",
        backgroundColor: "#F9FAFB",
        padding: 20,
        borderRadius: 12,
      }}
    >
      {/* Underlined header */}
      <div
        style={{
          display: "flex",
          fontSize: 18,
          fontWeight: 700,
          color: "#111827",
          textDecoration: "underline",
          marginBottom: 12,
        }}
      >
        Q4 Metrics
      </div>

      {/* Stacked rows with negative margin overlap */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            backgroundColor: "#DBEAFE",
            borderRadius: 8,
            padding: 12,
            alignItems: "center",
          }}
        >
          {/* Scaled indicator dot */}
          <div
            style={{
              display: "flex",
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#3B82F6",
              transform: "scale(1.5)",
              marginRight: 10,
            }}
          />
          {/* Constrained column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 200,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 13,
                fontWeight: 700,
                color: "#1E40AF",
              }}
            >
              Revenue
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 20,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              $12.4k
            </div>
          </div>
        </div>

        {/* Second row — negative marginTop for overlap */}
        <div
          style={{
            display: "flex",
            backgroundColor: "#D1FAE5",
            borderRadius: 8,
            padding: 12,
            marginTop: -6,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#10B981",
              transform: "scale(1.5)",
              marginRight: 10,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 200,
              maxHeight: 40,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 13,
                fontWeight: 700,
                color: "#065F46",
              }}
            >
              Conversions
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 20,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              1,234
            </div>
          </div>
        </div>

        {/* Third row — negative marginTop + pre-wrap notes */}
        <div
          style={{
            display: "flex",
            backgroundColor: "#FEF3C7",
            borderRadius: 8,
            padding: 12,
            marginTop: -6,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#F59E0B",
              transform: "scale(1.5)",
              marginRight: 10,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 250,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 13,
                fontWeight: 700,
                color: "#92400E",
              }}
            >
              Notes
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 11,
                color: "#78350F",
                whiteSpace: "pre-wrap" as const,
              }}
            >
              {"Target met.\nNext: expand."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BannerStrip — rotated elements, gradient with transparent, asymmetric radii
// ---------------------------------------------------------------------------

interface BannerStripProps {
  width: number;
  height: number;
}

function BannerStrip({ width, height }: BannerStripProps) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        fontFamily: "Inter",
        backgroundColor: "#1E293B",
        overflow: "hidden",
        alignItems: "center",
      }}
    >
      {/* Rotated accent stripe */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: -20,
          left: -20,
          width: 160,
          height: 160,
          backgroundColor: "#6366F1",
          transform: "rotate(-8deg)",
          opacity: 0.3,
        }}
      />

      {/* Gradient fade overlay */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: "50%",
          height: "100%",
          backgroundImage: "linear-gradient(to right, #6366F1, transparent)",
          opacity: 0.2,
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "0 24px",
          flexGrow: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 18,
            fontWeight: 700,
            color: "white",
          }}
        >
          Special Offer
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 12,
            color: "#94A3B8",
            marginTop: 2,
          }}
        >
          Limited time deal
        </div>
      </div>

      {/* CTA pill — one-sided radii */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          paddingRight: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            backgroundColor: "#F59E0B",
            color: "#111827",
            fontWeight: 700,
            fontSize: 13,
            padding: "8px 16px",
            borderTopLeftRadius: 20,
            borderBottomLeftRadius: 20,
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
          }}
        >
          Shop Now
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlurShowcaseCard — filter: blur() on div and image
// ---------------------------------------------------------------------------

interface BlurShowcaseCardProps {
  width: number;
  height: number;
  imageDataUri: string;
}

function BlurShowcaseCard({
  width,
  height,
  imageDataUri,
}: BlurShowcaseCardProps) {
  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        backgroundColor: "#F8FAFC",
        padding: 16,
        gap: 16,
        fontFamily: "Inter",
      }}
    >
      {/* Blurred div */}
      <div
        style={{
          display: "flex",
          flex: 1,
          filter: "blur(4px)",
          backgroundColor: "#6366F1",
          borderRadius: 8,
        }}
      />
      {/* Blurred image */}
      <img
        src={imageDataUri}
        width={Math.floor((width - 48) / 2)}
        height={height - 32}
        style={{
          flex: 1,
          filter: "blur(3px)",
          borderRadius: 8,
          objectFit: "cover",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectFitCoverCard — objectFit cover with cropping
// ---------------------------------------------------------------------------

interface ObjectFitCoverCardProps {
  width: number;
  height: number;
  imageDataUri: string;
}

function ObjectFitCoverCard({
  width,
  height,
  imageDataUri,
}: ObjectFitCoverCardProps) {
  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        backgroundColor: "#F1F5F9",
        padding: 16,
        gap: 16,
        alignItems: "center",
        fontFamily: "Inter",
      }}
    >
      {/* Wide image in a tall box — cover crops horizontally */}
      <div
        style={{
          display: "flex",
          width: 120,
          height: height - 32,
          overflow: "hidden",
          borderRadius: 12,
        }}
      >
        <img
          src={imageDataUri}
          style={{ objectFit: "cover", width: 120, height: height - 32 }}
        />
      </div>
      {/* Same image in a wide box — cover crops vertically */}
      <img
        src={imageDataUri}
        style={{
          objectFit: "cover",
          width: width - 120 - 48,
          height: 100,
          borderRadius: 12,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const WIDTH = 400;
const HEIGHT = 300;

const propertyCases: {
  label: string;
  props: Omit<PropertyCardProps, "width" | "height">;
}[] = [
  {
    label: "new apartment with many features",
    props: {
      address: "1234 NW Evergreen Terrace Boulevard, Springfield, OR 97403",
      price: "$425,000",
      status: "NEW",
      beds: 3,
      baths: 2,
      sqft: "1,850",
      features: [
        "Central AC",
        "Garage",
        "Pool",
        "Hardwood Floors",
        "Updated Kitchen",
        "Fenced Yard",
      ],
    },
  },
  {
    label: "sold house with few features",
    props: {
      address: "42 Oak Lane",
      price: "$289,000",
      status: "SOLD",
      beds: 2,
      baths: 1,
      sqft: "960",
      features: ["Parking", "Balcony"],
    },
  },
];

describe.skipIf(!HAS_NATIVE_DEPS)("visual comparison: canvas vs satori", () => {
  let fonts: FontData[];

  beforeAll(async () => {
    fonts = await loadFonts();
  });

  it.each(propertyCases)(
    "renders PropertyCard — $label",
    async ({ label, props }) => {
      const element = <PropertyCard width={WIDTH} height={HEIGHT} {...props} />;

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const { percentage } = await compareImages(
        canvasPng,
        satoriPng,
        `property-${label}`,
      );

      expect(percentage).toBeLessThan(2.5);
    },
  );

  // -------------------------------------------------------------------------
  // PricingCard tests
  // -------------------------------------------------------------------------

  const pricingCases: {
    label: string;
    props: Omit<PricingCardProps, "width" | "height">;
    maxDiff: number;
  }[] = [
    {
      label: "highlighted Pro plan with yearly discount",
      props: {
        planName: "Pro",
        monthlyPrice: 29,
        yearlyPrice: 278,
        features: [
          "Unlimited projects",
          "Priority support",
          "Custom domain",
          "Analytics",
        ],
        highlighted: true,
      },
      maxDiff: 1.25,
    },
    {
      label: "plain Starter plan without yearly",
      props: {
        planName: "Starter",
        monthlyPrice: 9,
        features: ["5 projects", "Community support", "Basic analytics"],
        highlighted: false,
      },
      maxDiff: 0.9,
    },
  ];

  it.each(pricingCases)(
    "renders PricingCard — $label",
    async ({ label, props, maxDiff }) => {
      const element = <PricingCard width={WIDTH} height={HEIGHT} {...props} />;

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const { percentage } = await compareImages(
        canvasPng,
        satoriPng,
        `pricing-${label}`,
      );

      expect(percentage).toBeLessThan(maxDiff);
    },
  );

  // -------------------------------------------------------------------------
  // TagCloud tests
  // -------------------------------------------------------------------------

  const tagCloudCases: {
    label: string;
    props: Omit<TagCloudProps, "width" | "height">;
  }[] = [
    {
      label: "many short tags wrapping",
      props: {
        tags: [
          "React",
          "Vue",
          "Svelte",
          "Solid",
          "Angular",
          "Ember",
          "Preact",
          "Lit",
          "Alpine",
        ],
      },
    },
    {
      label: "tags with long label truncated",
      props: {
        tags: [
          "TypeScript",
          "Internationalization Configuration",
          "Go",
          "Rust",
        ],
      },
    },
  ];

  it.each(tagCloudCases)(
    "renders TagCloud — $label",
    async ({ label, props }) => {
      const element = <TagCloud width={WIDTH} height={HEIGHT} {...props} />;

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const { percentage } = await compareImages(
        canvasPng,
        satoriPng,
        `tags-${label}`,
      );

      expect(percentage).toBeLessThan(1);
    },
  );

  // -------------------------------------------------------------------------
  // StatsBar tests
  // -------------------------------------------------------------------------

  const statsBarCases: {
    label: string;
    props: Omit<StatsBarProps, "width" | "height">;
  }[] = [
    {
      label: "3 stats mixed positive and negative",
      props: {
        stats: [
          { label: "Revenue", value: "$12.4k", change: "+12%", positive: true },
          { label: "Users", value: "1,234", change: "-3%", positive: false },
          { label: "Orders", value: "856", change: "+8%", positive: true },
        ],
      },
    },
    {
      label: "4 stats all positive",
      props: {
        stats: [
          { label: "MRR", value: "$8.2k", change: "+5%", positive: true },
          { label: "DAU", value: "942", change: "+18%", positive: true },
          { label: "NPS", value: "72", change: "+4", positive: true },
          { label: "CSAT", value: "94%", change: "+2%", positive: true },
        ],
      },
    },
  ];

  it.each(statsBarCases)(
    "renders StatsBar — $label",
    async ({ label, props }) => {
      const element = <StatsBar width={WIDTH} height={HEIGHT} {...props} />;

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const { percentage } = await compareImages(
        canvasPng,
        satoriPng,
        `stats-${label}`,
      );

      expect(percentage).toBeLessThan(1);
    },
  );

  // -------------------------------------------------------------------------
  // ListingOverlayCard tests
  // -------------------------------------------------------------------------

  it("renders ListingOverlayCard — absolute positioning with gradients and filter", async () => {
    const element = <ListingOverlayCard width={WIDTH} height={HEIGHT} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "listing-overlay-card",
    );

    expect(percentage).toBeLessThan(1);
  });

  // -------------------------------------------------------------------------
  // GradientHeroCard tests
  // -------------------------------------------------------------------------

  it("renders GradientHeroCard — angled gradients with flexBasis and transforms", async () => {
    const element = <GradientHeroCard width={WIDTH} height={HEIGHT} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "gradient-hero-card",
    );

    expect(percentage).toBeLessThan(1);
  });

  // -------------------------------------------------------------------------
  // JobPostCard tests
  // -------------------------------------------------------------------------

  it("renders JobPostCard — wordBreak, boxShadow, tight lineHeight", async () => {
    const element = <JobPostCard width={WIDTH} height={HEIGHT} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "job-post-card",
    );

    expect(percentage).toBeLessThan(2.5);
  });

  // -------------------------------------------------------------------------
  // MetricsDashboard tests
  // -------------------------------------------------------------------------

  it("renders MetricsDashboard — negative margins, maxWidth, pre-wrap, underline", async () => {
    const element = <MetricsDashboard width={WIDTH} height={HEIGHT} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "metrics-dashboard",
    );

    expect(percentage).toBeLessThan(1);
  });

  // -------------------------------------------------------------------------
  // BannerStrip tests
  // -------------------------------------------------------------------------

  it("renders BannerStrip — rotation, gradient with transparent, asymmetric radii", async () => {
    const element = <BannerStrip width={400} height={120} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, 400, 120, fonts),
      renderWithSatori(element, 400, 120, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "banner-strip",
    );

    expect(percentage).toBeLessThan(1);
  });

  // -------------------------------------------------------------------------
  // BlurShowcaseCard tests
  // -------------------------------------------------------------------------

  it("renders BlurShowcaseCard — filter blur on div and image", async () => {
    const imageDataUri = await makeTestImage(120, 120);
    const element = (
      <BlurShowcaseCard
        width={WIDTH}
        height={HEIGHT}
        imageDataUri={imageDataUri}
      />
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "blur-showcase",
    );

    expect(percentage).toBeLessThan(1);
  });

  // -------------------------------------------------------------------------
  // ObjectFitCoverCard tests
  // -------------------------------------------------------------------------

  it("renders ObjectFitCoverCard — objectFit cover with cropping", async () => {
    const imageDataUri = await makeTestImage(160, 80); // landscape image
    const element = (
      <ObjectFitCoverCard
        width={WIDTH}
        height={HEIGHT}
        imageDataUri={imageDataUri}
      />
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "objectfit-cover",
    );

    expect(percentage).toBeLessThan(0.01);
  });

  // ---------------------------------------------------------------------------
  // Emoji rendering
  // ---------------------------------------------------------------------------

  it("renders emoji characters as images (twemoji)", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: 40,
          backgroundColor: "white",
          width: WIDTH,
          height: HEIGHT,
          fontFamily: "Inter",
        }}
      >
        <div style={{ fontSize: 48, color: "black" }}>Hello 🌍 World</div>
        <div style={{ fontSize: 32, color: "#666", marginTop: 20 }}>
          Stars ⭐⭐⭐
        </div>
        <div style={{ fontSize: 24, color: "#333", marginTop: 20 }}>
          Done 🎉
        </div>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts, "twemoji"),
      renderWithSatori(element, WIDTH, HEIGHT, fonts, "twemoji"),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "emoji-twemoji",
    );

    // Higher threshold due to SVG rasterization differences between Skia and resvg
    expect(percentage).toBeLessThan(2.5);
  });

  // ---------------------------------------------------------------------------
  // TranslateX transforms
  // ---------------------------------------------------------------------------

  function TranslateXCard({
    width,
    height,
  }: {
    width: number;
    height: number;
  }) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 32,
          backgroundColor: "#f0f0f0",
          width,
          height,
        }}
      >
        {/* No translation (baseline) */}
        <div
          style={{
            display: "flex",
            width: 120,
            height: 40,
            backgroundColor: "#3B82F6",
            transform: "translateX(0px)",
          }}
        />
        {/* Positive translateX */}
        <div
          style={{
            display: "flex",
            width: 120,
            height: 40,
            backgroundColor: "#EF4444",
            transform: "translateX(50px)",
          }}
        />
        {/* Negative translateX */}
        <div
          style={{
            display: "flex",
            width: 120,
            height: 40,
            backgroundColor: "#10B981",
            transform: "translateX(-30px)",
          }}
        />
        {/* Larger offset */}
        <div
          style={{
            display: "flex",
            width: 120,
            height: 40,
            backgroundColor: "#F59E0B",
            transform: "translateX(100px)",
          }}
        />
      </div>
    );
  }

  it("renders TranslateXCard — translateX transforms on elements", async () => {
    const element = <TranslateXCard width={WIDTH} height={HEIGHT} />;

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "translatex",
    );

    expect(percentage).toBeLessThan(0.01);
  });

  // -------------------------------------------------------------------------
  // BackgroundImage tests
  // -------------------------------------------------------------------------

  function BackgroundImageCard({
    width,
    height,
    imageDataUri,
    backgroundSize,
  }: {
    width: number;
    height: number;
    imageDataUri: string;
    backgroundSize?: string;
  }) {
    return (
      <div
        style={{
          display: "flex",
          width,
          height,
          backgroundImage: `url(${imageDataUri})`,
          ...(backgroundSize ? { backgroundSize } : {}),
          borderRadius: 12,
          overflow: "hidden",
        }}
      />
    );
  }

  const backgroundImageCases: {
    label: string;
    backgroundSize?: string;
  }[] = [
    { label: "default tiling" },
    { label: "cover", backgroundSize: "cover" },
    { label: "contain", backgroundSize: "contain" },
  ];

  it.each(backgroundImageCases)(
    "renders backgroundImage — $label",
    async ({ label, backgroundSize }) => {
      const imageDataUri = await makeTestImage(160, 80); // landscape image
      const element = (
        <BackgroundImageCard
          width={WIDTH}
          height={HEIGHT}
          imageDataUri={imageDataUri}
          backgroundSize={backgroundSize}
        />
      );

      const [canvasPng, satoriPng] = await Promise.all([
        renderWithCanvas(element, WIDTH, HEIGHT, fonts),
        renderWithSatori(element, WIDTH, HEIGHT, fonts),
      ]);
      const slug = `backgroundimage-${label.replace(/\s+/g, "-")}`;
      const { percentage } = await compareImages(canvasPng, satoriPng, slug);

      expect(percentage).toBeLessThan(1);
    },
  );

  // -------------------------------------------------------------------------
  // Viewport units (vw/vh) tests
  // -------------------------------------------------------------------------

  it("renders img with 100vw/100vh — viewport units fill the canvas", async () => {
    const imageDataUri = await makeTestImage(160, 80);
    const element = (
      <img
        src={imageDataUri}
        style={{
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
        }}
      />
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "viewport-units-100vw-100vh",
    );

    expect(percentage).toBeLessThan(1);
  });

  // -------------------------------------------------------------------------
  // Intrinsic image sizing tests
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // LayeredGradientCard tests
  // -------------------------------------------------------------------------

  it("renders LayeredGradientCard — multiple stacked CSS gradients", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          backgroundImage:
            "linear-gradient(rgba(75,162,254,0.5) 0%, rgba(75,162,254,0.8) 100%), linear-gradient(90deg, rgb(255,255,255) 0%, rgb(255,255,255) 100%)",
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontWeight: 700,
            color: "white",
          }}
        >
          Layered Gradients
        </div>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "layered-gradient-card",
    );

    expect(percentage).toBeLessThan(1);
  });

  // -------------------------------------------------------------------------
  // SVG fillRule="evenodd" tests
  // -------------------------------------------------------------------------

  it("renders SVG with fillRule evenodd — compound path cutouts", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          backgroundColor: "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Map pin icon with evenodd cutout */}
        <svg width="120" height="160" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
            fill="#EF4444"
          />
        </svg>
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "svg-fillrule-evenodd",
    );

    expect(percentage).toBeLessThan(1);
  });

  it("renders borderRadius 50% as a circle", async () => {
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          background: "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "red",
          }}
        />
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "border-radius-50-percent",
    );
    expect(percentage).toBeLessThan(1);
  });

  it("renders img with only height set — derives width from intrinsic aspect ratio", async () => {
    const imageDataUri = await makeTestImage(200, 100); // 2:1 landscape
    const element = (
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: HEIGHT,
          background: "white",
        }}
      >
        <img src={imageDataUri} style={{ height: 150, objectFit: "fill" }} />
      </div>
    );

    const [canvasPng, satoriPng] = await Promise.all([
      renderWithCanvas(element, WIDTH, HEIGHT, fonts),
      renderWithSatori(element, WIDTH, HEIGHT, fonts),
    ]);
    const { percentage } = await compareImages(
      canvasPng,
      satoriPng,
      "img-height-only-intrinsic",
    );
    expect(percentage).toBeLessThan(1);
  });
});
