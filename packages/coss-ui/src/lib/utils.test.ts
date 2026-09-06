import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins strings, arrays and conditional objects", () => {
    expect(cn("flex", ["items-center", { hidden: false, "gap-2": true }], undefined, null, 0, "")).toBe(
      "flex items-center gap-2"
    );
  });

  it("lets a later tailwind class override an earlier conflicting one", () => {
    expect(cn("px-2 py-1 text-sm", "px-4")).toBe("py-1 text-sm px-4");
    expect(cn("bg-default", { "bg-emphasis": true })).toBe("bg-emphasis");
  });

  it("keeps non-conflicting variants and arbitrary values", () => {
    expect(cn("hover:bg-muted", "bg-default", "w-[42px]")).toBe("hover:bg-muted bg-default w-[42px]");
  });

  it("returns an empty string for no usable input", () => {
    expect(cn(false, undefined, {})).toBe("");
  });
});
