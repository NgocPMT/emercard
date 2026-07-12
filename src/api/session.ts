import { requestJson, isApiError } from "./http-client";
import { currentSessionSchema, type CurrentSession } from "./types";

export const sessionKeys = {
  current: ["session", "current"] as const,
};

export async function getCurrentSession(signal?: AbortSignal): Promise<CurrentSession | null> {
  try {
    const response = await requestJson<unknown>({ path: "/me", signal });
    const parsed = currentSessionSchema.safeParse(response);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (isApiError(error) && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

export async function logout(signal?: AbortSignal) {
  await requestJson<void>({ path: "/auth/logout", method: "POST", signal });
}
