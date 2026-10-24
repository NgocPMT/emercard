import { client as generatedClient } from "./generated/client.gen";
import {
  currentUserApiV1MeGet,
  loginApiV1AuthLoginPost,
  logoutApiV1AuthLogoutPost,
  registerApiV1AuthRegisterPost,
} from "./generated/sdk.gen";
import type { CurrentUserOutput, UserLoginInput as GeneratedUserLoginInput, UserRegistrationInput as GeneratedUserRegistrationInput } from "./generated/types.gen";
import { ApiError, readApiError } from "./errors";
import { isApiError } from "./http-client";
import type { CurrentSession } from "./types";

const authClientConfig = {
  cache: "no-store" as const,
  credentials: "same-origin" as const,
  referrerPolicy: "strict-origin-when-cross-origin" as const,
};

generatedClient.setConfig(authClientConfig);

type FieldsResult<TData, TError> =
  | {
      data: TData;
      error: undefined;
      request?: Request;
      response?: Response;
    }
  | {
      data: undefined;
      error: TError;
      request?: Request;
      response?: Response;
    };

function networkError() {
  return new ApiError({
    status: 0,
    code: "network_error",
    message: "Không thể kết nối tới máy chủ",
    retryable: true,
  });
}

export type UserLoginInput = {
  email: string;
  password: string;
  identifier?: string;
};

export type UserRegistrationInput = {
  email: string;
  phone?: string;
  password: string;
  username?: string;
};

export function normalizeCurrentSession(user: CurrentUserOutput): CurrentSession {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

async function resolveResult<TData, TError>(resultPromise: Promise<FieldsResult<TData, TError>>): Promise<TData> {
  try {
    const result = await resultPromise;
    if (result.data !== undefined) {
      return result.data;
    }
    if (result.response) {
      if (result.response.ok) {
        return undefined as TData;
      }
      throw await readApiError(result.response);
    }
    throw networkError();
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }
    throw networkError();
  }
}

export async function registerAccount(payload: UserRegistrationInput, signal?: AbortSignal): Promise<CurrentSession> {
  const bodyPayload: GeneratedUserRegistrationInput = {
    email: payload.email,
    password: payload.password,
    ...(payload.phone ? { phone: payload.phone.trim() } : {}),
  } as GeneratedUserRegistrationInput;

  const user = await resolveResult<CurrentUserOutput, unknown>(
    registerApiV1AuthRegisterPost({ body: bodyPayload, signal }) as Promise<FieldsResult<CurrentUserOutput, unknown>>,
  );
  return normalizeCurrentSession(user);
}

export async function login(payload: UserLoginInput, signal?: AbortSignal): Promise<CurrentSession> {
  const bodyPayload: GeneratedUserLoginInput = {
    email: payload.identifier?.trim() || payload.email,
    password: payload.password,
  };

  const user = await resolveResult<CurrentUserOutput, unknown>(
    loginApiV1AuthLoginPost({ body: bodyPayload, signal }) as Promise<FieldsResult<CurrentUserOutput, unknown>>,
  );
  return normalizeCurrentSession(user);
}

export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentSession | null> {
  try {
    const user = await resolveResult<CurrentUserOutput, unknown>(
      currentUserApiV1MeGet({ signal }) as Promise<FieldsResult<CurrentUserOutput, unknown>>,
    );
    return normalizeCurrentSession(user);
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function logout(signal?: AbortSignal): Promise<void> {
  await resolveResult(logoutApiV1AuthLogoutPost({ signal }));
}

export type { CurrentSession };
