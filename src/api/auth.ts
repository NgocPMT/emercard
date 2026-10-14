import { client as generatedClient } from "./generated/client.gen";
import { isApiError, requestJson } from "./http-client";
import { clearTokens, getAccessToken, setTokens } from "./token-storage";
import type { CurrentSession } from "./types";

const authClientConfig = {
  cache: "no-store" as const,
  credentials: "same-origin" as const,
  referrerPolicy: "strict-origin-when-cross-origin" as const,
  auth: () => getAccessToken() ?? undefined,
};

generatedClient.setConfig(authClientConfig);

export type RawUserOutput = {
  id: string;
  email: string;
  role: "user" | "admin" | string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSuccessResponse = {
  user: RawUserOutput;
  tokens: AuthTokensResponse;
};

export type UserLoginInput = {
  email: string;
  password: string;
  identifier?: string;
};

export type UserRegistrationInput = {
  email: string;
  password: string;
  username?: string;
};

export function normalizeCurrentSession(user: RawUserOutput): CurrentSession {
  return {
    id: user.id,
    email: user.email,
    role: user.role === "admin" ? "admin" : "user",
    created_at: user.created_at ?? user.createdAt,
    updated_at: user.updated_at ?? user.updatedAt,
  };
}

export async function registerAccount(payload: UserRegistrationInput, signal?: AbortSignal): Promise<CurrentSession> {
  const fallbackUsername =
    payload.email.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) || "user";
  const username = payload.username ?? fallbackUsername;

  const response = await requestJson<AuthSuccessResponse>({
    path: "/auth/register",
    method: "POST",
    body: {
      email: payload.email,
      username,
      password: payload.password,
    },
    signal,
  });

  setTokens(response.tokens);
  return normalizeCurrentSession(response.user);
}

export async function login(payload: UserLoginInput, signal?: AbortSignal): Promise<CurrentSession> {
  const response = await requestJson<AuthSuccessResponse>({
    path: "/auth/login",
    method: "POST",
    body: {
      identifier: payload.identifier ?? payload.email,
      password: payload.password,
    },
    signal,
  });

  setTokens(response.tokens);
  return normalizeCurrentSession(response.user);
}

export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentSession | null> {
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  try {
    const user = await requestJson<RawUserOutput>({
      path: "/auth/me",
      signal,
    });
    return normalizeCurrentSession(user);
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      clearTokens();
      return null;
    }
    throw error;
  }
}

export async function logout(_signal?: AbortSignal): Promise<void> {
  clearTokens();
}

export type { CurrentSession };
