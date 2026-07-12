import { errorEnvelopeSchema, type ErrorEnvelope, type ValidationDetail } from "./types";

export type FieldError = {
  path: string;
  message: string;
  type: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details: FieldError[];
  readonly retryable: boolean;

  constructor({ status, code, message, requestId, details = [], retryable }: { status: number; code: string; message: string; requestId?: string; details?: FieldError[]; retryable: boolean }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
    this.retryable = retryable;
  }
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return errorEnvelopeSchema.safeParse(value).success;
}

export function validationDetailToFieldError(detail: ValidationDetail): FieldError {
  const [head, ...tail] = detail.location;
  const pathParts = head === "body" ? tail : detail.location;
  const path = pathParts.map((part) => String(part)).join(".");
  return {
    path: path || "form",
    message: detail.message,
    type: detail.type,
  };
}

export function detailsToFieldErrors(details: ValidationDetail[] | undefined): FieldError[] {
  return details?.map(validationDetailToFieldError) ?? [];
}

export function isRetryableStatus(status: number) {
  return status === 429 || status === 503 || status >= 500;
}

export async function readApiError(response: Response): Promise<ApiError> {
  let parsed: unknown = null;
  const requestId = response.headers.get("X-Request-ID") ?? undefined;

  try {
    parsed = await response.clone().json();
  } catch {
    parsed = null;
  }

  if (isErrorEnvelope(parsed)) {
    const { error } = parsed;
    return new ApiError({
      status: response.status,
      code: error.code,
      message: error.message,
      requestId: error.request_id ?? requestId,
      details: detailsToFieldErrors(error.details),
      retryable: isRetryableStatus(response.status),
    });
  }

  return new ApiError({
    status: response.status,
    code: response.status >= 500 ? "server_error" : "api_error",
    message: `Request failed with status ${response.status}`,
    requestId,
    retryable: isRetryableStatus(response.status),
  });
}
