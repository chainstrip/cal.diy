import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "../types/events";
import { CalendarStoreContext, createCalendarStore, useCalendarStore } from "./store";

const event = (id: number, start: string, end: string): CalendarEvent => ({
  id,
  title: `Event ${id}`,
  start: new Date(start),
  end: new Date(end),
});

describe("createCalendarStore", () => {
  it("applies the initial props on top of the defaults", () => {
    const startDate = new Date("2025-03-03T00:00:00.000Z");
    const store = createCalendarStore({ view: "day", startDate, timezone: "Europe/Berlin" });

    const state = store.getState();
    expect(state.view).toBe("day");
    expect(state.startDate).toBe(startDate);
    expect(state.timezone).toBe("Europe/Berlin");
    expect(state.gridCellsPerHour).toBe(4);
    expect(state.events).toEqual([]);
  });

  it("initState sorts events when asked and merges overlapping blocking dates", () => {
    const store = createCalendarStore();
    const later = event(2, "2025-03-04T10:00:00.000Z", "2025-03-04T11:00:00.000Z");
    const earlier = event(1, "2025-03-03T10:00:00.000Z", "2025-03-03T11:00:00.000Z");

    store.getState().initState({
      startDate: new Date("2025-03-03T00:00:00.000Z"),
      endDate: new Date("2025-03-09T23:59:59.999Z"),
      events: [later, earlier],
      sortEvents: true,
      blockingDates: [
        { start: new Date("2025-03-05T09:00:00.000Z"), end: new Date("2025-03-05T11:00:00.000Z") },
        { start: new Date("2025-03-05T10:00:00.000Z"), end: new Date("2025-03-05T12:00:00.000Z") },
      ],
      selectedBookingUid: "uid-1",
    });

    const state = store.getState();
    expect(state.events.map((e) => e.id)).toEqual([1, 2]);
    expect(state.blockingDates).toEqual([
      { start: new Date("2025-03-05T09:00:00.000Z"), end: new Date("2025-03-05T12:00:00.000Z") },
    ]);
    expect(state.selectedBookingUid).toBe("uid-1");
  });

  it("moves the visible week forward and backward, telling the consumer about it", () => {
    const onDateChange = vi.fn();
    const startDate = new Date("2025-03-03T00:00:00.000Z");
    const endDate = new Date("2025-03-09T23:59:59.999Z");
    const store = createCalendarStore({ view: "week", startDate, endDate });
    store.setState({ onDateChange });

    store.getState().handleDateChange("INCREMENT");
    expect(store.getState().startDate).toEqual(new Date("2025-03-10T00:00:00.000Z"));
    expect(store.getState().endDate).toEqual(new Date("2025-03-16T23:59:59.999Z"));
    expect(onDateChange).toHaveBeenLastCalledWith(
      new Date("2025-03-10T00:00:00.000Z"),
      new Date("2025-03-16T23:59:59.999Z")
    );

    store.getState().handleDateChange("DECREMENT");
    expect(store.getState().startDate).toEqual(startDate);
    expect(store.getState().endDate).toEqual(endDate);
    expect(onDateChange).toHaveBeenCalledTimes(2);
  });

  it("refuses to move past maxDate", () => {
    const onDateChange = vi.fn();
    const startDate = new Date("2025-03-03T00:00:00.000Z");
    const endDate = new Date("2025-03-09T23:59:59.999Z");
    const store = createCalendarStore({ view: "week", startDate, endDate, maxDate: new Date("2025-03-12T00:00:00.000Z") });
    store.setState({ onDateChange });

    store.getState().handleDateChange("INCREMENT");

    expect(store.getState().startDate).toBe(startDate);
    expect(store.getState().endDate).toBe(endDate);
    expect(onDateChange).not.toHaveBeenCalled();
  });
});

describe("useCalendarStore", () => {
  it("throws outside of a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useCalendarStore((s) => s.view))).toThrow(
      "useCalendarStore must be used within a CalendarStoreProvider"
    );
    spy.mockRestore();
  });

  it("selects a slice of the provided store and re-renders on change", () => {
    const store = createCalendarStore({ view: "week" });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CalendarStoreContext.Provider value={store}>{children}</CalendarStoreContext.Provider>
    );

    const { result } = renderHook(() => useCalendarStore((s) => s.view), { wrapper });
    expect(result.current).toBe("week");

    act(() => {
      store.getState().setView("day");
    });
    expect(result.current).toBe("day");
  });
});
