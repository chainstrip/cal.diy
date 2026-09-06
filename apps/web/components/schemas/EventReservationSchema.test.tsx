import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EventReservationSchema from "./EventReservationSchema";

function renderSchema(status: "ACCEPTED" | "PENDING" | "CANCELLED" | "REJECTED" | "AWAITING_HOST") {
  const { container } = render(
    <EventReservationSchema
      reservationId="booking-uid-1"
      eventName="30 min with Alice"
      startTime={new Date("2025-03-10T10:00:00.000Z")}
      endTime={new Date("2025-03-10T10:30:00.000Z")}
      organizer={{ name: "Alice", email: "alice@example.com" }}
      attendees={[
        { name: "Bob", email: "bob@example.com" },
        { name: "Carol", email: "carol@example.com" },
      ]}
      location="Cal Video"
      description="Intro call"
      status={status}
    />
  );
  const script = container.querySelector('script[type="application/ld+json"]');
  if (!script) throw new Error("no JSON-LD script rendered");
  return JSON.parse(script.textContent ?? "");
}

describe("EventReservationSchema", () => {
  it("renders the booking as a schema.org EventReservation JSON-LD block", () => {
    const json = renderSchema("ACCEPTED");

    expect(json["@context"]).toBe("https://schema.org");
    expect(json["@type"]).toBe("EventReservation");
    expect(json.reservationId).toBe("booking-uid-1");
    expect(json.reservationStatus).toBe("ReservationConfirmed");
    expect(json.reservationFor).toEqual({
      "@type": "Event",
      name: "30 min with Alice",
      startDate: new Date("2025-03-10T10:00:00.000Z").toString(),
      endDate: new Date("2025-03-10T10:30:00.000Z").toString(),
      organizer: { "@type": "Person", name: "Alice", email: "alice@example.com" },
      attendee: [
        { "@type": "Person", name: "Bob", email: "bob@example.com" },
        { "@type": "Person", name: "Carol", email: "carol@example.com" },
      ],
      location: "Cal Video",
      description: "Intro call",
    });
  });

  it("maps every booking status to a schema.org reservation status", () => {
    expect(renderSchema("PENDING").reservationStatus).toBe("ReservationPending");
    expect(renderSchema("CANCELLED").reservationStatus).toBe("ReservationCancelled");
    expect(renderSchema("REJECTED").reservationStatus).toBe("ReservationCancelled");
    expect(renderSchema("AWAITING_HOST").reservationStatus).toBe("ReservationHold");
  });

  it("omits organizer, location and description when they are absent", () => {
    const { container } = render(
      <EventReservationSchema
        reservationId="booking-uid-2"
        eventName="Quick chat"
        startTime={new Date("2025-03-10T10:00:00.000Z")}
        endTime={new Date("2025-03-10T10:15:00.000Z")}
        organizer={null}
        attendees={[]}
        location={null}
        description={null}
        status="ACCEPTED"
      />
    );
    const json = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "");

    expect(json.reservationFor).toEqual({
      "@type": "Event",
      name: "Quick chat",
      startDate: new Date("2025-03-10T10:00:00.000Z").toString(),
      endDate: new Date("2025-03-10T10:15:00.000Z").toString(),
      attendee: [],
    });
  });
});
