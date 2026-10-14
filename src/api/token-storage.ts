const ACCESS_TOKEN_KEY = "emercard_access_token";
const REFRESH_TOKEN_KEY = "emercard_refresh_token";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    const testKey = "__emercard_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function getAccessToken(): string | null {
  if (isLocalStorageAvailable()) {
    try {
      return window.localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return memoryAccessToken;
    }
  }
  return memoryAccessToken;
}

export function getRefreshToken(): string | null {
  if (isLocalStorageAvailable()) {
    try {
      return window.localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return memoryRefreshToken;
    }
  }
  return memoryRefreshToken;
}

export function setTokens(tokens: { accessToken: string; refreshToken: string }): void {
  memoryAccessToken = tokens.accessToken;
  memoryRefreshToken = tokens.refreshToken;

  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } catch {
      // Memory fallback remains updated if localStorage fails (e.g. quota exceeded)
    }
  }
}

export function clearTokens(): void {
  memoryAccessToken = null;
  memoryRefreshToken = null;

  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Ignore errors when clearing
    }
  }
}
