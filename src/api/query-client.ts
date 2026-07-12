import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./http-client";

export function createPageQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (isApiError(error)) {
            return error.retryable && failureCount < 1;
          }
          return failureCount < 1;
        },
        retryDelay: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retryOnMount: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
