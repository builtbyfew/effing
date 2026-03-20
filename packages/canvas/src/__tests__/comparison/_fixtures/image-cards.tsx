import React from "react";

// ---------------------------------------------------------------------------
// BlurShowcaseCard — filter: blur() on div and image
// ---------------------------------------------------------------------------

export interface BlurShowcaseCardProps {
  width: number;
  height: number;
  imageDataUri: string;
}

export function BlurShowcaseCard({
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
        fontFamily: "Liberation Sans",
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

export interface ObjectFitCoverCardProps {
  width: number;
  height: number;
  imageDataUri: string;
}

export function ObjectFitCoverCard({
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
        fontFamily: "Liberation Sans",
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
// BackgroundImageCard
// ---------------------------------------------------------------------------

export function BackgroundImageCard({
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
