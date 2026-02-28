import { describe, test, expect } from "vitest";
import React from "react";
import { expandToTree } from "./types.ts";
import type { ExpandedNode } from "./types.ts";
import { computeLayout } from "./layout.ts";
import type { MeasureTextFn } from "./styles.ts";

// Simple text measurement stub — returns 8px per character width, 16px height
const stubMeasure: MeasureTextFn = (text, _style, maxWidth) => {
  const charWidth = 8;
  const lineHeight = 16;
  const totalWidth = text.length * charWidth;

  if (maxWidth != null && totalWidth > maxWidth) {
    const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));
    const lines = Math.ceil(text.length / charsPerLine);
    return {
      width: Math.min(totalWidth, maxWidth),
      height: lines * lineHeight,
    };
  }

  return { width: totalWidth, height: lineHeight };
};

describe("expandToTree", () => {
  test("expands a simple div with text", () => {
    const el = React.createElement("div", null, "hello");
    const tree = expandToTree(el);
    expect(tree).toHaveLength(1);
    const node = tree[0] as { tag: string; children: ExpandedNode[] };
    expect(node.tag).toBe("div");
    expect(node.children).toHaveLength(1);
    expect((node.children[0] as { text: string }).text).toBe("hello");
  });

  test("expands function components", () => {
    function Greeting({ name }: { name: string }) {
      return React.createElement("span", null, `Hi ${name}`);
    }
    const el = React.createElement(Greeting, { name: "world" });
    const tree = expandToTree(el);
    expect(tree).toHaveLength(1);
    const node = tree[0] as { tag: string; children: ExpandedNode[] };
    expect(node.tag).toBe("span");
  });

  test("expands nested elements", () => {
    const el = React.createElement(
      "div",
      { style: { padding: 10 } },
      React.createElement("span", null, "child"),
    );
    const tree = expandToTree(el);
    expect(tree).toHaveLength(1);
    const div = tree[0] as { tag: string; children: ExpandedNode[] };
    expect(div.tag).toBe("div");
    expect(div.children).toHaveLength(1);
    const span = div.children[0] as { tag: string };
    expect(span.tag).toBe("span");
  });

  test("handles null and boolean children", () => {
    const el = React.createElement("div", null, null, false, "text", true);
    const tree = expandToTree(el);
    const div = tree[0] as { tag: string; children: ExpandedNode[] };
    expect(div.children).toHaveLength(1);
    expect((div.children[0] as { text: string }).text).toBe("text");
  });

  test("handles fragments", () => {
    const el = React.createElement(
      React.Fragment,
      null,
      React.createElement("div", null, "a"),
      React.createElement("span", null, "b"),
    );
    const tree = expandToTree(el);
    expect(tree).toHaveLength(2);
    expect((tree[0] as { tag: string }).tag).toBe("div");
    expect((tree[1] as { tag: string }).tag).toBe("span");
  });

  test("captures img src", () => {
    const el = React.createElement("img", { src: "test.png" });
    const tree = expandToTree(el);
    const img = tree[0] as { tag: string; imgSrc: string | null };
    expect(img.tag).toBe("img");
    expect(img.imgSrc).toBe("test.png");
  });
});

describe("computeLayout", () => {
  test("computes layout for a simple box", async () => {
    const nodes = expandToTree(
      React.createElement("div", { style: { width: 100, height: 50 } }),
    );
    const { layout } = await computeLayout(nodes, 400, 300, stubMeasure);

    expect(layout.width).toBe(400);
    expect(layout.height).toBe(300);
    expect(layout.children).toHaveLength(1);
    expect(layout.children[0].width).toBe(100);
    expect(layout.children[0].height).toBe(50);
  });

  test("computes layout with text content", async () => {
    const nodes = expandToTree(
      React.createElement("div", { style: { width: 200 } }, "Hello"),
    );
    const { layout } = await computeLayout(nodes, 400, 300, stubMeasure);

    const child = layout.children[0];
    expect(child.width).toBe(200);
    // Should have measured text height
    expect(child.height).toBeGreaterThan(0);
  });

  test("computes flex layout with multiple children", async () => {
    const nodes = expandToTree(
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            width: 300,
            height: 100,
          },
        },
        React.createElement("div", { style: { width: 100, height: 100 } }),
        React.createElement("div", { style: { width: 100, height: 100 } }),
      ),
    );
    const { layout } = await computeLayout(nodes, 400, 300, stubMeasure);
    const container = layout.children[0];

    expect(container.children).toHaveLength(2);
    expect(container.children[0].left).toBe(0);
    expect(container.children[0].width).toBe(100);
    expect(container.children[1].left).toBe(100);
    expect(container.children[1].width).toBe(100);
  });

  test("computes layout with padding", async () => {
    const nodes = expandToTree(
      React.createElement(
        "div",
        { style: { width: 200, padding: 20 } },
        React.createElement("div", { style: { height: 50 } }),
      ),
    );
    const { layout } = await computeLayout(nodes, 400, 300, stubMeasure);
    const container = layout.children[0];
    const child = container.children[0];

    expect(child.left).toBe(20);
    expect(child.top).toBe(20);
    expect(child.width).toBe(160); // 200 - 20*2
  });

  test("computes layout with absolute positioning", async () => {
    const nodes = expandToTree(
      React.createElement(
        "div",
        { style: { width: 300, height: 300 } },
        React.createElement("div", {
          style: {
            position: "absolute",
            top: 10,
            left: 10,
            width: 50,
            height: 50,
          },
        }),
      ),
    );
    const { layout } = await computeLayout(nodes, 400, 400, stubMeasure);
    const child = layout.children[0].children[0];

    expect(child.top).toBe(10);
    expect(child.left).toBe(10);
    expect(child.width).toBe(50);
    expect(child.height).toBe(50);
  });
});
