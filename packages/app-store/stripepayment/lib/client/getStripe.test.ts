import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StripeWindow = Window & { Stripe?: unknown };

/**
 * `@stripe/stripe-js/pure` resolves with the global `Stripe` constructor when Stripe.js is already
 * on the page instead of injecting the script tag, so the whole load path runs without network.
 */
describe("getStripe", () => {
  const stripeCtor = vi.fn((publicKey: string) => ({ publicKey, elements: vi.fn() }));

  beforeEach(() => {
    vi.resetModules();
    (window as StripeWindow).Stripe = stripeCtor;
    stripeCtor.mockClear();
  });

  afterEach(() => {
    delete (window as StripeWindow).Stripe;
  });

  it("instantiates Stripe once with the given public key and reuses the promise", async () => {
    const { default: getStripe } = await import("./getStripe");

    const first = getStripe("pk_test_first");
    const second = getStripe("pk_test_second");

    expect(second).toBe(first);
    const stripe = await first;
    expect(stripe).toEqual(expect.objectContaining({ publicKey: "pk_test_first" }));
    expect(stripeCtor).toHaveBeenCalledTimes(1);
    expect(stripeCtor).toHaveBeenCalledWith("pk_test_first");
  });

  it("falls back to the configured public key when none is passed", async () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLIC_KEY", "pk_test_from_env");
    const { default: getStripe } = await import("./getStripe");

    const stripe = await getStripe();

    expect(stripe).toEqual(expect.objectContaining({ publicKey: "pk_test_from_env" }));
    vi.unstubAllEnvs();
  });
});
