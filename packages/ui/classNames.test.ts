import { describe, expect, it } from "vitest";

import classNames from "./classNames";

describe("classNames", () => {
  it("drops falsy entries and joins the rest", () => {
    expect(classNames("text-default", false, undefined, null, 0, "font-medium")).toBe("text-default font-medium");
  });

  it("resolves conflicting tailwind utilities in favour of the last one", () => {
    expect(classNames("p-2 text-sm", "p-4")).toBe("text-sm p-4");
    expect(classNames("rounded-md", "rounded-none")).toBe("rounded-none");
  });

  it("returns an empty string when nothing is passed", () => {
    expect(classNames()).toBe("");
  });
});
