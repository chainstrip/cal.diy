import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsToggle } from "./SettingsToggle";

// jsdom has no Web Animations API, and @formkit/auto-animate calls element.animate
// asynchronously, from a MutationObserver callback, on every DOM mutation inside the
// toggle's content container. The stub is installed once for the whole file (never
// torn down between tests) because a pending mutation callback can still fire after a
// test's own afterEach would have removed it.
const animate = vi.fn(() => ({
  finished: new Promise<void>(() => undefined),
  cancel: vi.fn(),
  commitStyles: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  currentTime: 0,
  playState: "running",
  onfinish: null,
}));
Object.defineProperty(Element.prototype, "animate", { configurable: true, writable: true, value: animate });

describe("SettingsToggle", () => {
  beforeEach(() => {
    animate.mockClear();
  });

  it("renders the title, description and switch state", () => {
    render(
      <SettingsToggle
        title="Requires confirmation"
        description="Approve every booking by hand"
        checked={false}
        data-testid="requires-confirmation"
      />
    );

    expect(screen.getByText("Requires confirmation")).toBeInTheDocument();
    expect(screen.getByText("Approve every booking by hand")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("calls onCheckedChange with the new value when toggled", () => {
    const onCheckedChange = vi.fn();
    render(<SettingsToggle title="Hide notes" checked={false} onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("shows the children only while checked, inside the animated container", () => {
    const { rerender } = render(
      <SettingsToggle title="Limit bookings" checked={false}>
        <p>limit settings</p>
      </SettingsToggle>
    );
    expect(screen.queryByText("limit settings")).not.toBeInTheDocument();

    rerender(
      <SettingsToggle title="Limit bookings" checked={true}>
        <p>limit settings</p>
      </SettingsToggle>
    );
    expect(screen.getByText("limit settings")).toBeInTheDocument();
  });

  it("supports the switch-at-the-end layout with a badge and a hidden switch", () => {
    render(
      <SettingsToggle
        title="Seats"
        checked={true}
        toggleSwitchAtTheEnd
        Badge={<span>beta</span>}
        hideSwitch
        data-testid="seats">
        <p>seat settings</p>
      </SettingsToggle>
    );

    expect(screen.getByTestId("seats-title")).toHaveTextContent("Seats");
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText("seat settings")).toBeInTheDocument();
  });

  it("disables the switch when asked", () => {
    render(<SettingsToggle title="Locked" checked={false} disabled />);

    expect(screen.getByRole("switch")).toBeDisabled();
  });
});
