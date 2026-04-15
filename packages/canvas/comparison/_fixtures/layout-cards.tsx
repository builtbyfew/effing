import React from "react";

// ---------------------------------------------------------------------------
// TranslateXCard — translateX transforms on elements
// ---------------------------------------------------------------------------

export function TranslateXCard({
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
