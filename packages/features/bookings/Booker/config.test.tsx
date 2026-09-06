import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookerLayout, BookerState } from "./types";
import { resizeAnimationConfig, useBookerResizeAnimation } from "./config";

function Booker({ layout, state }: { layout: BookerLayout; state: BookerState }) {
  const ref = useBookerResizeAnimation(layout, state);
  return <div data-testid="booker" ref={ref} />;
}

// jsdom has no Web Animations API. framer-motion may hand the height animation to
// `element.animate` on a later frame, so a stub keeps that frame from throwing.
const animate = vi.fn(() => ({
  finished: new Promise<void>(() => undefined),
  cancel: vi.fn(),
  commitStyles: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  currentTime: 0,
  playState: "running",
  onfinish: null,
}));

describe("useBookerResizeAnimation", () => {
  beforeEach(() => {
    animate.mockClear();
    Object.defineProperty(Element.prototype, "animate", { configurable: true, writable: true, value: animate });
  });

  afterEach(() => {
    delete (Element.prototype as { animate?: unknown }).animate;
  });

  it("applies the month view grid template and animates the height to its configured value", () => {
    render(<Booker layout="month_view" state="selecting_date" />);
    const el = screen.getByTestId("booker");
    const config = resizeAnimationConfig.month_view.default;

    // width is `calc(var(...) + var(...))`, which jsdom's style parser drops, so it is not asserted here
    expect(el.style.gridTemplateAreas).toBe(config.gridTemplateAreas);
    expect(el.style.gridTemplateColumns).toBe(config.gridTemplateColumns);
    expect(el.style.gridTemplateRows).toBe(config.gridTemplateRows);
    expect(el.style.minHeight).toBe(config.minHeight);
    // framer-motion resolves the animated height to the configured value
    expect(el.style.height).toBe(config.height);
  });

  it("switches to the timeslot columns when a date is selected", () => {
    const { rerender } = render(<Booker layout="month_view" state="selecting_date" />);
    rerender(<Booker layout="month_view" state="selecting_time" />);
    const el = screen.getByTestId("booker");
    const config = resizeAnimationConfig.month_view.selecting_time;

    expect(el.style.gridTemplateAreas).toBe(config.gridTemplateAreas);
    expect(el.style.gridTemplateColumns).toBe(config.gridTemplateColumns);
    expect(el.style.gridTemplateRows).toBe(config.gridTemplateRows);
  });

  it("writes every property directly on mobile, where nothing is animated", () => {
    render(<Booker layout="mobile" state="booking" />);
    const el = screen.getByTestId("booker");
    const config = resizeAnimationConfig.mobile.default;

    expect(el.style.gridTemplateAreas).toBe(config.gridTemplateAreas);
    expect(el.style.gridTemplateColumns).toBe(config.gridTemplateColumns);
    expect(el.style.width).toBe(config.width);
    expect(el.style.minHeight).toBe(config.minHeight);
    expect(el.style.height).toBe("auto");
  });

  it("uses the full-screen template for the week view", () => {
    render(<Booker layout="week_view" state="loading" />);
    const el = screen.getByTestId("booker");

    expect(el.style.width).toBe("100vw");
    expect(el.style.minHeight).toBe("100vh");
    expect(el.style.gridTemplateRows).toBe("70px auto");
  });
});
