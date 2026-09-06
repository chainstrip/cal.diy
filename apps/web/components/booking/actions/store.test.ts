import { describe, expect, it } from "vitest";

import { createBookingActionsStore } from "./store";

describe("createBookingActionsStore", () => {
  it("starts with every dialog closed", () => {
    const store = createBookingActionsStore();
    const state = store.getState();

    const dialogFlags = Object.entries(state).filter(([, value]) => typeof value === "boolean");
    expect(dialogFlags).toHaveLength(13);
    expect(dialogFlags.every(([, value]) => value === false)).toBe(true);
  });

  it("opens and closes a dialog through its setter", () => {
    const store = createBookingActionsStore();

    store.getState().setIsCancelDialogOpen(true);
    expect(store.getState().isCancelDialogOpen).toBe(true);
    expect(store.getState().isOpenRescheduleDialog).toBe(false);

    store.getState().setIsCancelDialogOpen(false);
    expect(store.getState().isCancelDialogOpen).toBe(false);
  });

  it("accepts a React-style updater function", () => {
    const store = createBookingActionsStore();

    store.getState().setIsOpenReassignDialog((prev) => !prev);
    expect(store.getState().isOpenReassignDialog).toBe(true);

    store.getState().setIsOpenReassignDialog((prev) => !prev);
    expect(store.getState().isOpenReassignDialog).toBe(false);
  });

  it("notifies subscribers exactly once per change and keeps stores independent", () => {
    const a = createBookingActionsStore();
    const b = createBookingActionsStore();
    const seen: boolean[] = [];
    const unsubscribe = a.subscribe((state) => seen.push(state.isNoShowDialogOpen));

    a.getState().setIsNoShowDialogOpen(true);
    a.getState().setIsNoShowDialogOpen(false);
    unsubscribe();
    a.getState().setIsNoShowDialogOpen(true);

    expect(seen).toEqual([true, false]);
    expect(b.getState().isNoShowDialogOpen).toBe(false);
  });
});
