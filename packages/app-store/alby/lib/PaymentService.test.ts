import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@calcom/lib/errorCodes";

const prismaMock = vi.hoisted(() => ({
  booking: { findUnique: vi.fn() },
  payment: { create: vi.fn() },
}));

vi.mock("@calcom/prisma", () => ({ default: prismaMock }));

import { BuildPaymentService } from "./PaymentService";

// BOLT11 test vector from the Lightning spec (no amount, "Please consider supporting this project").
const PAYMENT_REQUEST =
  "lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w";

const credentials = {
  key: {
    account_id: "acc_1",
    account_email: "host@example.com",
    account_lightning_address: "host@getalby.com",
    webhook_endpoint_id: "wh_1",
    webhook_endpoint_secret: "whsec",
  },
};

function mockLightningAddressResponses() {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      lnurlp: {
        tag: "payRequest",
        callback: "https://getalby.com/lnurlp/host/callback",
        minSendable: 1000,
        maxSendable: 100000000000,
        commentAllowed: 255,
        metadata: '[["text/plain","Sats for host"]]',
      },
      keysend: null,
      nostr: null,
    })
  );
  fetchMock.mockResponseOnce(JSON.stringify({ invoice: { pr: PAYMENT_REQUEST } }));
}

describe("Alby PaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.resetMocks();
    prismaMock.booking.findUnique.mockResolvedValue({ uid: "booking-uid", title: "30 min with Host" });
    prismaMock.payment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 1,
      ...data,
    }));
  });

  it("is set up only when the credential key parses", () => {
    expect(BuildPaymentService(credentials).isSetupAlready()).toBe(true);
    expect(BuildPaymentService({ key: { account_id: "only" } }).isSetupAlready()).toBe(false);
  });

  it("requests a lightning invoice for the booking and stores it as the payment", async () => {
    mockLightningAddressResponses();
    const service = BuildPaymentService(credentials);

    const payment = await service.create({ amount: 2100, currency: "btc" }, 55, 3, "host", "Booker", "ON_BOOKING", "booker@example.com");

    // lightning address details, then invoice generation
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const detailsUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(detailsUrl.pathname).toBe("/lnurl/lightning-address-details");
    expect(detailsUrl.searchParams.get("ln")).toBe("host@getalby.com");
    const invoiceUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(invoiceUrl.pathname).toBe("/lnurl/generate-invoice");
    expect(invoiceUrl.searchParams.get("ln")).toBe("host@getalby.com");
    expect(invoiceUrl.searchParams.get("amount")).toBe("2100000"); // msat
    const payerdata = JSON.parse(invoiceUrl.searchParams.get("payerdata") ?? "{}");
    expect(payerdata.appId).toBe("cal.com");
    expect(typeof payerdata.referenceId).toBe("string");

    expect(prismaMock.payment.create).toHaveBeenCalledTimes(1);
    const { data } = prismaMock.payment.create.mock.calls[0][0];
    expect(data.uid).toBe(payerdata.referenceId);
    expect(data.externalId).toBe(PAYMENT_REQUEST);
    expect(data.amount).toBe(2100);
    expect(data.currency).toBe("btc");
    expect(data.booking).toEqual({ connect: { id: 55 } });
    expect(data.app).toEqual({ connect: { slug: "alby" } });
    expect(data.success).toBe(false);
    expect(data.data.invoice.isPaid).toBe(false);
    expect(data.data.invoice.paymentRequest).toBe(PAYMENT_REQUEST);
    expect(data.data.invoice.description).toBe("Please consider supporting this project");
    expect(payment.externalId).toBe(PAYMENT_REQUEST);
  });

  it("rejects an amount below the lightning address minimum", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        lnurlp: {
          tag: "payRequest",
          callback: "https://getalby.com/lnurlp/host/callback",
          minSendable: 10000,
          maxSendable: 100000000000,
          metadata: '[["text/plain","Sats for host"]]',
        },
      })
    );
    const service = BuildPaymentService(credentials);

    await expect(
      service.create({ amount: 1, currency: "btc" }, 55, 3, "host", "Booker", "ON_BOOKING", "booker@example.com")
    ).rejects.toThrow(ErrorCode.PaymentCreationFailure);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });

  it("fails without touching the network when the booking does not exist", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null);
    const service = BuildPaymentService(credentials);

    await expect(
      service.create({ amount: 2100, currency: "btc" }, 404, 3, "host", "Booker", "ON_BOOKING", "booker@example.com")
    ).rejects.toThrow(ErrorCode.PaymentCreationFailure);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
