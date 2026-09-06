import { describe, expect, it } from "vitest";

import { markdownToSafeHTML } from "./markdownToSafeHTML";

describe("markdownToSafeHTML", () => {
  it("returns an empty string for an empty description", () => {
    expect(markdownToSafeHTML(null)).toBe("");
    expect(markdownToSafeHTML("")).toBe("");
  });

  it("renders headings, emphasis, links and lists", () => {
    const html = markdownToSafeHTML("# Intro\n\nSome **bold** and *italic* text with a [link](https://cal.com).\n\n- one\n- two");

    expect(html).toContain("<h1>Intro</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('<a href="https://cal.com">link</a>');
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>two</li>");
  });

  it("strips scripts and event handlers that a booker could inject through an event description", () => {
    const html = markdownToSafeHTML('Hello <script>alert(1)</script><img src=x onerror="alert(2)"> world');

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).toContain("Hello");
    expect(html).toContain("world");
  });

  it("neutralises javascript: links", () => {
    const html = markdownToSafeHTML("[click](javascript:alert(1))");

    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });
});
