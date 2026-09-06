import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Calendar } from "./Calendar";

describe("Calendar", () => {
  it("renders the month grid with the custom caption and outside days", () => {
    render(<Calendar mode="single" defaultMonth={new Date(2025, 2, 1)} />);

    expect(screen.getByText("March")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
    // March 2025 starts on a Saturday, so the grid begins with outside days from February
    const days = screen.getAllByRole("gridcell");
    expect(days.length).toBeGreaterThanOrEqual(31);
    expect(days[0]).toHaveTextContent("23");
    expect(days[6]).toHaveTextContent("1");
  });

  it("reports the clicked day to onSelect", () => {
    const onSelect = vi.fn();
    render(<Calendar mode="single" defaultMonth={new Date(2025, 2, 1)} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("gridcell", { name: "15" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const selected = onSelect.mock.calls[0][0] as Date;
    expect(selected.getFullYear()).toBe(2025);
    expect(selected.getMonth()).toBe(2);
    expect(selected.getDate()).toBe(15);
  });

  it("marks the selected day and disables days before fromDate", () => {
    render(
      <Calendar
        mode="single"
        defaultMonth={new Date(2025, 2, 1)}
        selected={new Date(2025, 2, 20)}
        fromDate={new Date(2025, 2, 10)}
      />
    );

    expect(screen.getByRole("gridcell", { name: "20" })).toHaveAttribute("aria-selected", "true");
    // "5" also matches the outside day April 5; the first match is March 5
    expect(screen.getAllByRole("gridcell", { name: "5" })[0]).toBeDisabled();
    expect(screen.getByRole("gridcell", { name: "10" })).not.toBeDisabled();
  });

  it("navigates to the next month", () => {
    render(<Calendar mode="single" defaultMonth={new Date(2025, 2, 1)} />);

    fireEvent.click(screen.getByRole("button", { name: /next month/i }));

    expect(screen.getByText("April")).toBeInTheDocument();
    expect(screen.queryByText("March")).not.toBeInTheDocument();
  });
});
