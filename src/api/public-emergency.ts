import { z } from "zod";
import { requestJson } from "./http-client";
import { publicEmergencyProfileSchema, type PublicEmergencyProfile } from "./types";

export const publicEmergencyKeys = {
  profile: (token: string) => ["public-emergency", token] as const,
};

const publicEmergencyResponseSchema = z.object({ profile: publicEmergencyProfileSchema });

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

export async function getPublicEmergencyProfile(token: string, signal?: AbortSignal): Promise<PublicEmergencyProfile | null> {
  try {
    const response = await requestJson<unknown>({
      path: `/emergency/${encodeURIComponent(token)}`,
      signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    const parsed = publicEmergencyResponseSchema.safeParse(response);
    return parsed.success ? parsed.data.profile : null;
  } catch {
    return null;
  }
}
