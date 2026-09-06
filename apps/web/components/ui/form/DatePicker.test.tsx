import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatePicker } from "./DatePicker";

function input(container: HTMLElement, name: string) {
  const el = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!el) throw new Error(`no input named ${name}`);
  return el;
}

describe("DatePicker", () => {
  it("shows the given date split into day, month and year fields", () => {
    const { container } = render(<DatePicker date={new Date(2025, 2, 10)} />);

    expect(input(container, "date").value).toBe("2025-03-10");
    expect(input(container, "day").value).toBe("10");
    expect(input(container, "month").value).toBe("3");
    expect(input(container, "year").value).toBe("2025");
  });

  it("reports a new date when the user edits the day field", () => {
    const onDatesChange = vi.fn();
    const { container } = render(<DatePicker date={new Date(2025, 2, 10)} onDatesChange={onDatesChange} />);

    fireEvent.change(input(container, "day"), { target: { value: "15" } });

    expect(onDatesChange).toHaveBeenCalledTimes(1);
    const next = onDatesChange.mock.calls[0][0] as Date;
    expect(next.getFullYear()).toBe(2025);
    expect(next.getMonth()).toBe(2);
    expect(next.getDate()).toBe(15);
  });

  it("does not let the fields go below minDate", () => {
    const { container } = render(
      <DatePicker date={new Date(2025, 2, 10)} minDate={new Date(2025, 2, 5)} />
    );

    expect(input(container, "date").min).toBe("2025-03-05");
    expect(input(container, "year").min).toBe("2025");
  });

  it("disables every field when disabled", () => {
    const { container } = render(<DatePicker date={new Date(2025, 2, 10)} disabled />);

    expect(input(container, "day")).toBeDisabled();
    expect(input(container, "month")).toBeDisabled();
    expect(input(container, "year")).toBeDisabled();
  });

  it("opens the calendar popup from the calendar button", () => {
    const { container } = render(<DatePicker date={new Date(2025, 2, 10)} />);
    const button = container.querySelector<HTMLButtonElement>("button.react-date-picker__calendar-button");
    if (!button) throw new Error("no calendar button");

    fireEvent.click(button);

    expect(container.querySelector(".react-calendar")).not.toBeNull();
    expect(container.querySelector(".react-calendar__tile--active")).toHaveTextContent("10");
  });
});
