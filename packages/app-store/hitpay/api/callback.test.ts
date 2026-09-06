import type { NextApiRequest, NextApiResponse } from "next";
import { createMocks } from "node-mocks-http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  payment: { findFirst: vi.fn() },
  credential: { findFirst: vi.fn() },
  booking: { update: vi.fn() },
}));

vi.mock("@calcom/prisma", () => ({ default: prismaMock }));

import handler from "./callback";

function buildPayment() {
  return {
    id: 11,
    amount: 5000,
    bookingId: 22,
    data: {
      id: "req_123",
      url: "https://hit-pay.example/pay/req_123",
      defaultLink: "https://hit-pay.example/default/req_123",
      email: "booker@example.com",
    },
    booking: {
      uid: "booking-uid-1",
      userId: 3,
      user: { email: "host@example.com", username: "host" },
      responses: {},
      eventType: { slug: "30min", teamId: null },
    },
  };
}

describe("hitpay callback handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.credential.findFirst.mockResolvedValue({ key: { isSandbox: true } });
  });

  it("redirects a completed payment to the booking success page with a query built from the payment data", async () => {
    prismaMock.payment.findFirst.mockResolvedValue(buildPayment());
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { reference: "req_123", status: "completed" },
    });

    await handler(req, res);

    expect(prismaMock.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { externalId: "req_123" } })
    );
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
    expect(res._getRedirectUrl()).toBe(
      "/booking/booking-uid-1?flag.coep=false&isSuccessBookingPage=true&email=booker%40example.com&eventTypeSlug=30min"
    );
  });

  it("cancels the booking and sends the booker back to the event page when the payment did not complete", async () => {
    prismaMock.payment.findFirst.mockResolvedValue(buildPayment());
    prismaMock.booking.update.mockResolvedValue({});
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { reference: "req_123", status: "failed" },
    });

    await handler(req, res);

    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: 22 },
      data: { status: "CANCELLED" },
    });
    expect(res._getRedirectUrl()).toBe("/host/30min");
  });

  it("looks the credential up by team when the event type belongs to a team", async () => {
    const payment = buildPayment();
    payment.booking.eventType.teamId = 9 as unknown as null;
    prismaMock.payment.findFirst.mockResolvedValue(payment);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { reference: "req_123", status: "completed" },
    });

    await handler(req, res);

    expect(prismaMock.credential.findFirst).toHaveBeenCalledWith({
      where: { type: "hitpay_payment", teamId: 9 },
    });
  });

  it("throws when the payment reference is unknown", async () => {
    prismaMock.payment.findFirst.mockResolvedValue(null);
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { reference: "nope", status: "completed" },
    });

    await expect(handler(req, res)).rejects.toMatchObject({ statusCode: 204, message: "Payment not found" });
  });
});
