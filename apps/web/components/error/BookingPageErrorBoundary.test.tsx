import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureReactException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureReactException }));

import BookingPageErrorBoundary from "./BookingPageErrorBoundary";

function Explode({ when }: { when: boolean }) {
  if (when) throw new Error("slot fetch failed");
  return <p>booking page content</p>;
}

describe("BookingPageErrorBoundary", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.clearAllMocks();
  });

  it("renders its children while nothing throws", () => {
    render(
      <BookingPageErrorBoundary>
        <Explode when={false} />
      </BookingPageErrorBoundary>
    );

    expect(screen.getByText("booking page content")).toBeInTheDocument();
    expect(captureReactException).not.toHaveBeenCalled();
  });

  it("shows the error page with the thrown error and reports it", () => {
    render(
      <BookingPageErrorBoundary>
        <Explode when={true} />
      </BookingPageErrorBoundary>
    );

    expect(screen.queryByText("booking page content")).not.toBeInTheDocument();
    expect(screen.getByText("It's not you, it's us.")).toBeInTheDocument();
    expect(screen.getByText("Error: slot fetch failed")).toBeInTheDocument();
    expect(captureReactException).toHaveBeenCalledTimes(1);
    const [error, info] = captureReactException.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("slot fetch failed");
    expect(info).toEqual(expect.objectContaining({ componentStack: expect.any(String) }));
  });

  it("re-renders the children when the user tries again", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    let shouldThrow = true;
    function Once() {
      return <Explode when={shouldThrow} />;
    }

    render(
      <BookingPageErrorBoundary>
        <Once />
      </BookingPageErrorBoundary>
    );
    expect(screen.getByText("It's not you, it's us.")).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("booking page content")).toBeInTheDocument();
  });
});
