import { describe, expect, it } from "vitest";
import { detailsToFieldErrors, readApiError, validationDetailToFieldError } from "./errors";

describe("api errors", () => {
  it("maps validation locations to stable field paths", () => {
    expect(
      validationDetailToFieldError({
        location: ["body", "email"],
        message: "Email is required",
        type: "missing",
      }),
    ).toEqual({ path: "email", message: "Email is required", type: "missing" });
  });

  it("reads backend error envelopes", async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: "validation_error",
          message: "Invalid payload",
          request_id: "req-123",
          details: [{ location: ["body", "email"], message: "Invalid", type: "value_error" }],
        },
      }),
      { status: 422, headers: { "content-type": "application/json", "X-Request-ID": "req-123" } },
    );

    const error = await readApiError(response);
    expect(error.code).toBe("validation_error");
    expect(error.status).toBe(422);
    expect(error.requestId).toBe("req-123");
    expect(error.details).toEqual([{ path: "email", message: "Invalid", type: "value_error" }]);
  });

  it("returns empty field errors when validation details are absent", () => {
    expect(detailsToFieldErrors(undefined)).toEqual([]);
  });
});
