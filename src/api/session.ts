import { getCurrentUser as fetchCurrentUser, logout as logoutSession } from "./auth";
import type { CurrentSession } from "./types";

export const sessionKeys = {
  current: ["session", "current"] as const,
};

export async function getCurrentSession(signal?: AbortSignal): Promise<CurrentSession | null> {
  return fetchCurrentUser(signal);
}

export async function logout(signal?: AbortSignal) {
  await logoutSession(signal);
}
