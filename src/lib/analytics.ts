export interface AnalyticsEventParams {
  category?: string;
  label?: string;
  value?: number;
  [key: string]: unknown;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Dispatches an event to Google Analytics (gtag.js) if available.
 * Fails safely and silently if GA is not loaded or disabled in the current environment.
 */
export function trackEvent(
  eventName: string,
  params?: AnalyticsEventParams,
): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
    return true;
  }

  return false;
}
