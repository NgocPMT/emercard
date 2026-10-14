import { publicEnv } from "../config/public-env";
import { ApiError, readApiError } from "./errors";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./token-storage";

let activeRefreshPromise: Promise<boolean> | null = null;

export async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const refreshResponse = await fetch(buildApiUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshResponse.ok) {
        clearTokens();
        return false;
      }

      const data = (await refreshResponse.json()) as { accessToken: string; refreshToken?: string };
      setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? refreshToken,
      });
      return true;
    } catch {
      return false;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export type ApiRequestOptions = {
  path: string;
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  referrerPolicy?: ReferrerPolicy;
};

function getOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "http://localhost:4321";
}

export function buildApiUrl(path: string) {
  const basePath = publicEnv.PUBLIC_API_BASE_PATH.startsWith("/")
    ? publicEnv.PUBLIC_API_BASE_PATH
    : `/${publicEnv.PUBLIC_API_BASE_PATH}`;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${basePath}/v1${normalizedPath}`, getOrigin());
}

function createTimeoutSignal(timeoutMs?: number) {
  if (!timeoutMs || timeoutMs <= 0) return null;
  const controller = new AbortController();
  const handle = window.setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  controller.signal.addEventListener(
    "abort",
    () => {
      window.clearTimeout(handle);
    },
    { once: true },
  );
  return controller;
}

function joinSignals(signal?: AbortSignal, timeoutSignal?: AbortSignal) {
  if (!signal) return timeoutSignal ?? null;
  if (!timeoutSignal) return signal;
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason ?? timeoutSignal.reason);
  if (signal.aborted || timeoutSignal.aborted) {
    abort();
    return controller.signal;
  }
  signal.addEventListener("abort", abort, { once: true });
  timeoutSignal.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

function serializeBody(body: unknown) {
  if (
    body === undefined ||
    body === null ||
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  ) {
    return body;
  }
  return JSON.stringify(body);
}

export async function requestJson<TResponse>({
  path,
  method = "GET",
  body,
  headers,
  signal,
  timeoutMs,
  credentials = "same-origin",
  cache = "no-store",
  referrerPolicy = "strict-origin-when-cross-origin",
}: ApiRequestOptions): Promise<TResponse> {
  const timeoutController = typeof window !== "undefined" ? createTimeoutSignal(timeoutMs) : null;
  const requestSignal = joinSignals(signal, timeoutController?.signal);
  const requestHeaders = new Headers(headers);
  const token = getAccessToken();
  if (token && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }
  const serializedBody = serializeBody(body);

  if (serializedBody !== undefined && !requestHeaders.has("Content-Type") && !(serializedBody instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      method,
      body: serializedBody as BodyInit | null | undefined,
      headers: requestHeaders,
      signal: requestSignal ?? undefined,
      credentials,
      cache,
      referrerPolicy,
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: "network_error",
      message: "Không thể kết nối tới máy chủ",
      retryable: true,
    });
  }

  if (response.status === 401 && !path.includes("/auth/refresh") && !path.includes("/auth/login")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryHeaders = new Headers(requestHeaders);
      const newToken = getAccessToken();
      if (newToken) {
        retryHeaders.set("Authorization", `Bearer ${newToken}`);
      }
      try {
        response = await fetch(buildApiUrl(path), {
          method,
          body: serializedBody as BodyInit | null | undefined,
          headers: retryHeaders,
          signal: requestSignal ?? undefined,
          credentials,
          cache,
          referrerPolicy,
        });
      } catch {
        throw new ApiError({
          status: 0,
          code: "network_error",
          message: "Không thể kết nối tới máy chủ",
          retryable: true,
        });
      }
    }
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as TResponse;
  }

  const text = await response.text();
  return text as TResponse;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
