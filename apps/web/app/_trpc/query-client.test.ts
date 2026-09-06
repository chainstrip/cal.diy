import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { queryClient } from "./query-client";

type RetryFn = (failureCount: number, error: unknown) => boolean;

function retry(): RetryFn {
  const fn = queryClient.getDefaultOptions().queries?.retry;
  if (typeof fn !== "function") throw new Error("retry must be configured as a function");
  return fn as RetryFn;
}

function trpcError(code: string) {
  return new TRPCClientError("request failed", {
    result: {
      error: {
        message: "request failed",
        code: -32000,
        data: { code, httpStatus: 400, path: "viewer.me" },
      },
    },
  });
}

describe("queryClient retry policy", () => {
  it("does not retry a tRPC error the client cannot fix (bad request, forbidden, unauthorized)", () => {
    for (const code of ["BAD_REQUEST", "FORBIDDEN", "UNAUTHORIZED"]) {
      expect(retry()(0, trpcError(code))).toBe(false);
    }
  });

  it("retries other tRPC errors up to three times", () => {
    const error = trpcError("INTERNAL_SERVER_ERROR");
    expect(retry()(0, error)).toBe(true);
    expect(retry()(2, error)).toBe(true);
    expect(retry()(3, error)).toBe(false);
  });

  it("retries a plain network error up to three times", () => {
    const error = new Error("Failed to fetch");
    expect(retry()(1, error)).toBe(true);
    expect(retry()(3, error)).toBe(false);
  });

  it("keeps identical queries fresh for one second", () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(1000);
  });
});
