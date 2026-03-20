import React from "react";

// ---------------------------------------------------------------------------
// PropertyCard component
// ---------------------------------------------------------------------------

export interface PropertyCardProps {
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

export function PropertyCard({
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
        fontFamily: "Liberation Sans",
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

export interface PricingCardProps {
  width: number;
  height: number;
  planName: string;
  monthlyPrice: number;
  yearlyPrice?: number;
  features: string[];
  highlighted?: boolean;
}

export function PricingCard({
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
        fontFamily: "Liberation Sans",
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

export interface TagCloudProps {
  width: number;
  height: number;
  tags: string[];
}

export function TagCloud({ width, height, tags }: TagCloudProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        width,
        height,
        fontFamily: "Liberation Sans",
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

export interface StatItem {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

export interface StatsBarProps {
  width: number;
  height: number;
  stats: StatItem[];
}

export function StatsBar({ width, height, stats }: StatsBarProps) {
  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        fontFamily: "Liberation Sans",
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

export interface ListingOverlayCardProps {
  width: number;
  height: number;
}

export function ListingOverlayCard({ width, height }: ListingOverlayCardProps) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        fontFamily: "Liberation Sans",
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

export interface GradientHeroCardProps {
  width: number;
  height: number;
}

export function GradientHeroCard({ width, height }: GradientHeroCardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        fontFamily: "Liberation Sans",
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

export interface JobPostCardProps {
  width: number;
  height: number;
}

export function JobPostCard({ width, height }: JobPostCardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        fontFamily: "Liberation Sans",
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

export interface MetricsDashboardProps {
  width: number;
  height: number;
}

export function MetricsDashboard({ width, height }: MetricsDashboardProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        fontFamily: "Liberation Sans",
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

export interface BannerStripProps {
  width: number;
  height: number;
}

export function BannerStrip({ width, height }: BannerStripProps) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        fontFamily: "Liberation Sans",
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
