import { z } from "zod";
import { isApiError, requestJson } from "./http-client";
import { publicEmergencyResponseSchema, type PublicEmergencyProfile } from "./types";

export const publicEmergencyKeys = {
  profile: (token: string) => ["public-emergency", token] as const,
};

export type PublicEmergencyLookupState =
  | { kind: "available"; profile: PublicEmergencyProfile }
  | { kind: "not_found" }
  | { kind: "disabled" }
  | { kind: "pending" }
  | { kind: "revoked" }
  | { kind: "expired" }
  | { kind: "not_ready" }
  | { kind: "service_unavailable"; retryable: boolean };

const locationAlertRequestSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    accuracy_meters: z.number().finite().positive().max(10_000),
    occurred_at: z.string().datetime({ offset: true }),
  })
  .strict();

const locationAlertResponseSchema = z.object({
  status: z.enum(["sent", "unavailable", "cooldown"]),
});

export type LocationAlertRequest = z.infer<typeof locationAlertRequestSchema>;
export type PublicLocationAlertState =
  | { kind: "sent" }
  | { kind: "unavailable" }
  | { kind: "cooldown" }
  | { kind: "rate_limited" }
  | { kind: "invalid_request" }
  | { kind: "not_found" }
  | { kind: "disabled" }
  | { kind: "pending" }
  | { kind: "revoked" }
  | { kind: "expired" }
  | { kind: "not_ready" }
  | { kind: "service_unavailable"; retryable: boolean };

export function extractEmergencyToken(pathname: string) {
  const prefix = "/e/";
  if (!pathname.startsWith(prefix)) return null;
  const encodedToken = pathname.slice(prefix.length);
  if (!encodedToken || encodedToken.includes("/")) return null;
  try {
    const token = decodeURIComponent(encodedToken);
    return token && !token.includes("/") ? token : null;
  } catch {
    return null;
  }
}

export async function getPublicEmergencyProfile(
  token: string,
  signal?: AbortSignal,
): Promise<PublicEmergencyLookupState> {
  try {
    const response = await requestJson<unknown>({
      path: `/public/${encodeURIComponent(token)}`,
      signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    const parsed = publicEmergencyResponseSchema.safeParse(response);
    return parsed.success ? { kind: "available", profile: parsed.data.profile } : { kind: "service_unavailable", retryable: true };
  } catch (error) {
    if (isApiError(error)) {
      switch (error.code) {
        case "public_profile.not_found":
        case "emergency_profile.not_found":
          return { kind: "not_found" };
        case "public_profile.disabled":
        case "emergency_profile.disabled":
          return { kind: "disabled" };
        case "public_profile.pending":
        case "emergency_profile.pending":
          return { kind: "pending" };
        case "public_profile.revoked":
        case "emergency_profile.revoked":
          return { kind: "revoked" };
        case "public_profile.expired":
        case "emergency_profile.expired":
          return { kind: "expired" };
        case "public_profile.not_ready":
        case "emergency_profile.not_ready":
          return { kind: "not_ready" };
        default:
          return { kind: "service_unavailable", retryable: error.retryable };
      }
    }
    return { kind: "service_unavailable", retryable: true };
  }
}

export async function sendPublicEmergencyLocationAlert(
  token: string,
  payload: LocationAlertRequest,
  signal?: AbortSignal,
): Promise<PublicLocationAlertState> {
  const request = locationAlertRequestSchema.parse(payload);

  try {
    const response = await requestJson<unknown>({
      path: `/public/${encodeURIComponent(token)}/location-alert`,
      method: "POST",
      body: request,
      signal,
      timeoutMs: 15_000,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    const parsed = locationAlertResponseSchema.safeParse(response);
    if (!parsed.success) {
      return { kind: "service_unavailable", retryable: true };
    }
    return { kind: parsed.data.status };
  } catch (error) {
    if (!isApiError(error)) {
      return { kind: "service_unavailable", retryable: true };
    }
    if (error.status === 429) return { kind: "rate_limited" };
    switch (error.code) {
      case "public_profile.not_found":
      case "emergency_profile.not_found":
        return { kind: "not_found" };
      case "public_profile.disabled":
      case "emergency_profile.disabled":
        return { kind: "disabled" };
      case "public_profile.pending":
      case "emergency_profile.pending":
        return { kind: "pending" };
      case "public_profile.revoked":
      case "emergency_profile.revoked":
        return { kind: "revoked" };
      case "public_profile.expired":
      case "emergency_profile.expired":
        return { kind: "expired" };
      case "public_profile.not_ready":
      case "emergency_profile.not_ready":
        return { kind: "not_ready" };
      case "validation_error":
        return { kind: "invalid_request" };
      default:
        return { kind: "service_unavailable", retryable: error.retryable };
    }
  }
}
