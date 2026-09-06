import { describe, expect, it } from "vitest";

import { i18nInputSchema } from "./i18n.schema";

describe("i18nInputSchema", () => {
  it("keeps a locale the app supports", () => {
    expect(i18nInputSchema.parse({ locale: "pt-BR", CalComVersion: "5.0.0" })).toEqual({
      locale: "pt-BR",
      CalComVersion: "5.0.0",
    });
  });

  it("maps a regional variant to the closest supported locale", () => {
    // de-AT is not shipped; bcp-47 lookup narrows it to `de`
    expect(i18nInputSchema.parse({ locale: "de-AT", CalComVersion: "5.0.0" }).locale).toBe("de");
  });

  it("passes an unknown locale through unchanged for the client to fall back on", () => {
    expect(i18nInputSchema.parse({ locale: "xx-YY", CalComVersion: "5.0.0" }).locale).toBe("xx-YY");
  });

  it("rejects a locale shorter than two characters", () => {
    expect(() => i18nInputSchema.parse({ locale: "e", CalComVersion: "5.0.0" })).toThrow();
  });
});
