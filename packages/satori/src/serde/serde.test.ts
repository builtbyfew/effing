import { describe, test, expect } from "vitest";
import React, { type ReactElement, type ReactNode } from "react";
import {
  expandElement,
  serializeElement,
  deserializeElement,
} from "./index.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type El = ReactElement<any>;

describe("expandElement", () => {
  test("passes through null", () => {
    expect(expandElement(null)).toBeNull();
  });

  test("passes through string", () => {
    expect(expandElement("hello")).toBe("hello");
  });

  test("passes through number", () => {
    expect(expandElement(42)).toBe(42);
  });

  test("expands a function component to its intrinsic output", () => {
    function Greeting({ name }: { name: string }) {
      return React.createElement("span", null, `Hi ${name}`);
    }

    const element = React.createElement(Greeting, { name: "world" });
    const expanded = expandElement(element) as El;

    expect(expanded.type).toBe("span");
    expect(expanded.props.children).toBe("Hi world");
  });

  test("recursively expands nested function components", () => {
    function Inner() {
      return React.createElement("b", null, "deep");
    }
    function Outer() {
      return React.createElement("div", null, React.createElement(Inner));
    }

    const expanded = expandElement(React.createElement(Outer)) as El;

    expect(expanded.type).toBe("div");
    const child = expanded.props.children as El;
    expect(child.type).toBe("b");
    expect(child.props.children).toBe("deep");
  });

  test("handles arrays of elements", () => {
    const arr = ["text", React.createElement("div", null, "item")];
    const result = expandElement(arr) as unknown[];
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("text");
    expect((result[1] as El).type).toBe("div");
  });

  test("unwraps a Fragment to its children", () => {
    const fragment = React.createElement(
      React.Fragment,
      null,
      React.createElement("div", null, "a"),
      React.createElement("span", null, "b"),
    );
    const result = expandElement(fragment) as El[];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("div");
    expect(result[1].type).toBe("span");
  });

  test("unwraps nested Fragments", () => {
    const inner = React.createElement(
      React.Fragment,
      null,
      React.createElement("b", null, "deep"),
    );
    const outer = React.createElement(React.Fragment, null, inner);
    const result = expandElement(outer) as El;
    expect(result.type).toBe("b");
    expect(result.props.children).toBe("deep");
  });

  test("returns null for empty Fragment", () => {
    const fragment = React.createElement(React.Fragment);
    expect(expandElement(fragment)).toBeNull();
  });
});

describe("serializeElement", () => {
  test("converts an intrinsic element to the serialized shape", () => {
    const el = React.createElement("div", { style: { color: "red" } }, "hello");
    const serialized = serializeElement(el) as Record<string, unknown>;

    expect(serialized.__react_element__).toBe(true);
    expect(serialized.type).toBe("div");
    expect(serialized.key).toBeNull();
    expect((serialized.props as Record<string, unknown>).children).toBe(
      "hello",
    );
    expect((serialized.props as Record<string, unknown>).style).toStrictEqual({
      color: "red",
    });
  });

  test("serializes Buffer props to __buffer__ shape", () => {
    const buf = Buffer.from([1, 2, 3]);
    const el = React.createElement("img", { data: buf });
    const serialized = serializeElement(el) as Record<string, unknown>;
    const props = serialized.props as Record<string, unknown>;

    expect(props.data).toStrictEqual({
      __buffer__: true,
      data: [1, 2, 3],
    });
  });

  test("throws on un-expanded function components", () => {
    function MyComp() {
      return React.createElement("div");
    }
    const el = React.createElement(MyComp);

    expect(() => serializeElement(el)).toThrow(
      /Cannot serialize function component "MyComp"/,
    );
  });

  test("throws on unexpanded Fragment", () => {
    const fragment = React.createElement(
      React.Fragment,
      null,
      React.createElement("div"),
    );

    expect(() => serializeElement(fragment)).toThrow(
      /Cannot serialize element with type.*Call expandElement first/,
    );
  });

  test("passes through primitives", () => {
    expect(serializeElement(null)).toBeNull();
    expect(serializeElement("text")).toBe("text");
    expect(serializeElement(123)).toBe(123);
  });
});

describe("deserializeElement", () => {
  test("roundtrip produces an equivalent React element tree", () => {
    const original = React.createElement(
      "div",
      { style: { fontSize: 24 }, key: "root" },
      React.createElement("span", null, "child"),
    );

    const expanded = expandElement(original) as El;
    const serialized = serializeElement(expanded);
    const deserialized = deserializeElement(serialized) as El;

    expect(React.isValidElement(deserialized)).toBe(true);
    expect(deserialized.type).toBe("div");
    expect(deserialized.key).toBe("root");
    expect(deserialized.props.style).toStrictEqual({ fontSize: 24 });

    const child = deserialized.props.children as El;
    expect(child.type).toBe("span");
    expect(child.props.children).toBe("child");
  });

  test("restores Buffer props", () => {
    const buf = Buffer.from([10, 20, 30]);
    const el = React.createElement("img", { data: buf });
    const serialized = serializeElement(el);
    const deserialized = deserializeElement(serialized) as El;

    expect(Buffer.isBuffer(deserialized.props.data)).toBe(true);
    expect(deserialized.props.data).toStrictEqual(Buffer.from([10, 20, 30]));
  });

  test("passes through primitives", () => {
    expect(deserializeElement(null)).toBeNull();
    expect(deserializeElement("text")).toBe("text");
    expect(deserializeElement(42)).toBe(42);
  });
});

describe("roundtrip", () => {
  test("expand → serialize → deserialize produces a valid React element", () => {
    function Badge({ label }: { label: string }) {
      return React.createElement(
        "div",
        { style: { border: "1px solid" } },
        React.createElement("span", null, label),
      );
    }

    const original = React.createElement(Badge, { label: "OK" });
    const expanded = expandElement(original);
    const serialized = serializeElement(expanded as ReactNode);
    const restored = deserializeElement(serialized) as El;

    expect(React.isValidElement(restored)).toBe(true);
    expect(restored.type).toBe("div");
    const child = restored.props.children as El;
    expect(child.type).toBe("span");
    expect(child.props.children).toBe("OK");
  });

  test("roundtrip with Fragments", () => {
    const original = React.createElement(
      "div",
      null,
      React.createElement(
        React.Fragment,
        null,
        React.createElement("span", null, "a"),
        React.createElement("span", null, "b"),
      ),
    );

    const expanded = expandElement(original) as El;
    const serialized = serializeElement(expanded);
    const restored = deserializeElement(serialized) as El;

    expect(React.isValidElement(restored)).toBe(true);
    expect(restored.type).toBe("div");
    const children = restored.props.children as El[];
    expect(children).toHaveLength(2);
    expect(children[0].type).toBe("span");
    expect(children[0].props.children).toBe("a");
    expect(children[1].type).toBe("span");
    expect(children[1].props.children).toBe("b");
  });
});
