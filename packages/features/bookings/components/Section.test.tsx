import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookerStoreContext } from "@calcom/features/bookings/Booker/BookerStoreProvider";
import { createBookerStore } from "@calcom/features/bookings/Booker/store";
import type { BookerLayout } from "@calcom/features/bookings/Booker/types";

import { BookerSection } from "./Section";

function renderSection(layout: BookerLayout, ui: React.ReactElement) {
  const store = createBookerStore();
  store.setState({ layout });
  return render(<BookerStoreContext.Provider value={store}>{ui}</BookerStoreContext.Provider>);
}

describe("BookerSection", () => {
  it("places its children in the requested grid area", () => {
    renderSection(
      "month_view",
      <BookerSection area="meta" className="extra">
        <p>event meta</p>
      </BookerSection>
    );

    const section = screen.getByText("event meta").parentElement;
    expect(section).toHaveClass("[grid-area:meta]");
    expect(section).toHaveClass("extra");
  });

  it("picks the layout-specific area when the current layout names one", () => {
    renderSection(
      "week_view",
      <BookerSection area={{ default: "calendar", week_view: "main" }}>
        <p>calendar</p>
      </BookerSection>
    );

    expect(screen.getByText("calendar").parentElement).toHaveClass("[grid-area:main]");
  });

  it("falls back to the default area for other layouts", () => {
    renderSection(
      "month_view",
      <BookerSection area={{ default: "calendar", week_view: "main" }}>
        <p>calendar</p>
      </BookerSection>
    );

    expect(screen.getByText("calendar").parentElement).toHaveClass("[grid-area:calendar]");
  });

  it("renders nothing when explicitly hidden", () => {
    renderSection(
      "month_view",
      <BookerSection area="timeslots" visible={false}>
        <p>slots</p>
      </BookerSection>
    );

    expect(screen.queryByText("slots")).not.toBeInTheDocument();
  });
});
