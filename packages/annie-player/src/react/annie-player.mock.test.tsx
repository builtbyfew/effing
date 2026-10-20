// @vitest-environment jsdom
import { Component, act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { AnniePlayerCore } from "../core";
import { AnniePlayer } from "./index";

// A player whose constructor fails for a reason that has nothing to do with
// fps, even though it's a RangeError.
vi.mock("../core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core")>();
  return {
    ...actual,
    AnniePlayerCore: vi.fn(() => {
      throw new RangeError("Unexpected failure");
    }),
  };
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class Boundary extends Component<
  { onError: (error: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

it("lets an unexpected error from creating the player propagate", () => {
  // React logs errors caught by a boundary.
  vi.spyOn(console, "error").mockImplementation(() => {});
  const onError = vi.fn();
  const root = createRoot(document.createElement("div"));

  act(() =>
    root.render(
      <Boundary onError={onError}>
        <AnniePlayer src="/a.annie" height={100} />
      </Boundary>,
    ),
  );

  expect(AnniePlayerCore).toHaveBeenCalled();
  expect(onError).toHaveBeenCalledOnce();
  expect(onError.mock.calls[0][0]).toMatchObject({
    name: "RangeError",
    message: "Unexpected failure",
  });
  act(() => root.unmount());
});
