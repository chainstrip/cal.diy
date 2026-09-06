import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  activeFiltersParser,
  columnSizingParser,
  columnVisibilityParser,
  pageIndexParser,
  pageSizeParser,
  searchTermParser,
  segmentIdParser,
  sortingParser,
} from "./parsers";

describe("data-table url parsers", () => {
  it("round-trips the sorting state through the url", () => {
    const sorting = [
      { id: "startTime", desc: true },
      { id: "title", desc: false },
    ];
    const serialized = sortingParser.serialize(sorting);

    expect(sortingParser.parse(serialized)).toEqual(sorting);
    expect(sortingParser.parseServerSide(undefined)).toEqual([]);
  });

  it("drops a sorting entry that does not match the schema", () => {
    // desc must be a boolean; the invalid item is filtered out of the array
    expect(sortingParser.parse('{"id":"startTime","desc":"yes"}')).toEqual([]);
  });

  it("round-trips active filters that contain commas inside the JSON payload", () => {
    const filters = [
      { f: "status", v: { type: "ms", data: ["accepted", "pending"] } },
      { f: "title", v: { type: "t", data: { operator: "contains", operand: "sync, weekly" } } },
    ];
    const serialized = activeFiltersParser.serialize(filters);

    expect(activeFiltersParser.parse(serialized)).toEqual(filters);
  });

  it("parses column visibility and sizing as json objects", () => {
    expect(columnVisibilityParser.parse('{"email":false,"role":true}')).toEqual({ email: false, role: true });
    expect(columnSizingParser.parse('{"email":220}')).toEqual({ email: 220 });
    expect(columnVisibilityParser.parseServerSide(undefined)).toEqual({});
    expect(columnSizingParser.parseServerSide(undefined)).toEqual({});
  });

  it("falls back to the default page size for a non-positive value", () => {
    expect(pageSizeParser.parseServerSide("0")).toBe(DEFAULT_PAGE_SIZE);
    expect(pageSizeParser.parseServerSide("-5")).toBe(DEFAULT_PAGE_SIZE);
    expect(pageSizeParser.parseServerSide("abc")).toBe(DEFAULT_PAGE_SIZE);
    expect(pageSizeParser.parseServerSide("25")).toBe(25);
    expect(pageSizeParser.serialize(25)).toBe("25");
  });

  it("parses the page index, segment id and search term with their defaults", () => {
    expect(pageIndexParser.parseServerSide("3")).toBe(3);
    expect(pageIndexParser.parseServerSide(undefined)).toBe(0);
    expect(segmentIdParser.parseServerSide(undefined)).toBe("");
    expect(segmentIdParser.parseServerSide("42")).toBe("42");
    expect(searchTermParser.parseServerSide("alice")).toBe("alice");
  });
});
