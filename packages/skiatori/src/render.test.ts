import { describe, test, expect } from "vitest";
import React from "react";
import { pngFromSkiatori } from "./index.ts";

// PNG magic bytes: 137 80 78 71 13 10 26 10
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("pngFromSkiatori", () => {
  test("renders a simple colored box to a valid PNG", async () => {
    const element = React.createElement("div", {
      style: {
        width: 100,
        height: 100,
        backgroundColor: "red",
      },
    });

    const png = await pngFromSkiatori(element, { width: 200, height: 200 });

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.length).toBeGreaterThan(PNG_MAGIC.length);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  test("renders text to a valid PNG", async () => {
    const element = React.createElement(
      "div",
      {
        style: {
          width: 200,
          height: 100,
          backgroundColor: "white",
          color: "black",
          fontSize: 24,
        },
      },
      "Hello World",
    );

    const png = await pngFromSkiatori(element, { width: 200, height: 100 });

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  test("renders nested flex layout to a valid PNG", async () => {
    const element = React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          width: 400,
          height: 200,
          backgroundColor: "#f0f0f0",
        },
      },
      React.createElement("div", {
        style: {
          width: 100,
          height: 100,
          backgroundColor: "blue",
          borderRadius: 10,
        },
      }),
      React.createElement("div", {
        style: {
          width: 100,
          height: 100,
          backgroundColor: "green",
          margin: 10,
        },
      }),
    );

    const png = await pngFromSkiatori(element, { width: 400, height: 200 });

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  test("renders with border", async () => {
    const element = React.createElement("div", {
      style: {
        width: 100,
        height: 100,
        borderWidth: 2,
        borderColor: "black",
        borderRadius: 8,
      },
    });

    const png = await pngFromSkiatori(element, { width: 200, height: 200 });

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  test("renders with opacity", async () => {
    const element = React.createElement(
      "div",
      {
        style: {
          width: 200,
          height: 200,
          backgroundColor: "white",
        },
      },
      React.createElement("div", {
        style: {
          width: 100,
          height: 100,
          backgroundColor: "red",
          opacity: 0.5,
        },
      }),
    );

    const png = await pngFromSkiatori(element, { width: 200, height: 200 });

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  test("expands function components and renders", async () => {
    function Box({ color }: { color: string }) {
      return React.createElement("div", {
        style: { width: 50, height: 50, backgroundColor: color },
      });
    }

    const element = React.createElement(
      "div",
      { style: { display: "flex", flexDirection: "row" } },
      React.createElement(Box, { color: "red" }),
      React.createElement(Box, { color: "blue" }),
    );

    const png = await pngFromSkiatori(element, { width: 200, height: 100 });

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  test("renders with absolute positioning", async () => {
    const element = React.createElement(
      "div",
      { style: { width: 200, height: 200, backgroundColor: "white" } },
      React.createElement("div", {
        style: {
          position: "absolute",
          top: 10,
          left: 10,
          width: 50,
          height: 50,
          backgroundColor: "red",
        },
      }),
    );

    const png = await pngFromSkiatori(element, { width: 200, height: 200 });

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  test("handles empty element", async () => {
    const element = React.createElement("div", {
      style: { width: 100, height: 100 },
    });

    const png = await pngFromSkiatori(element, { width: 100, height: 100 });

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });
});
