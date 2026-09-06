import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";

import { ValidateMetadata } from "./validate-metadata";

/**
 * The decorator is applied the way TypeScript emits `@ValidateMetadata()` on a class
 * property, so no decorator syntax support is required from the test compiler.
 */
class BookingInput {
  metadata: unknown;

  constructor(metadata: unknown) {
    this.metadata = metadata;
  }
}
ValidateMetadata()(BookingInput.prototype, "metadata");

class OptionalMetadataInput {
  metadata?: unknown;

  constructor(metadata?: unknown) {
    this.metadata = metadata;
  }
}
ValidateMetadata({ message: "custom metadata message" })(OptionalMetadataInput.prototype, "metadata");

function errorsFor(metadata: unknown) {
  return validateSync(new BookingInput(metadata));
}

describe("ValidateMetadata", () => {
  it("accepts an object of strings, numbers and booleans", () => {
    expect(errorsFor({ source: "website", seats: 2, vip: true })).toEqual([]);
  });

  it("accepts an empty object", () => {
    expect(errorsFor({})).toEqual([]);
  });

  it("rejects a value that is not an object, with the documented message", () => {
    const errors = errorsFor("not-an-object");

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("metadata");
    expect(errors[0].constraints).toEqual({
      ValidateMetadata:
        "metadata must be an object with up to 50 keys, each key name up to 40 characters, and values with a maximum length of 500 characters.",
    });
  });

  it("rejects null", () => {
    expect(errorsFor(null)).toHaveLength(1);
  });

  it("rejects more than 50 keys", () => {
    const tooMany = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, "v"]));
    expect(errorsFor(tooMany)).toHaveLength(1);

    const justEnough = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, "v"]));
    expect(errorsFor(justEnough)).toEqual([]);
  });

  it("rejects a key longer than 40 characters", () => {
    expect(errorsFor({ ["k".repeat(41)]: "v" })).toHaveLength(1);
    expect(errorsFor({ ["k".repeat(40)]: "v" })).toEqual([]);
  });

  it("rejects a string value longer than 500 characters", () => {
    expect(errorsFor({ note: "x".repeat(501) })).toHaveLength(1);
    expect(errorsFor({ note: "x".repeat(500) })).toEqual([]);
  });

  it("rejects nested objects, arrays and null values", () => {
    expect(errorsFor({ nested: { a: 1 } })).toHaveLength(1);
    expect(errorsFor({ list: [1, 2] })).toHaveLength(1);
    expect(errorsFor({ nothing: null })).toHaveLength(1);
  });

  it("uses the caller's message when validation options provide one", () => {
    const errors = validateSync(new OptionalMetadataInput("bad"));

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({ ValidateMetadata: "custom metadata message" });
  });
});
