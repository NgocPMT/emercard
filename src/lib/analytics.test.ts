import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./analytics";

describe("analytics helper (trackEvent)", () => {
  const originalGtag = window.gtag;

  beforeEach(() => {
    delete window.gtag;
  });

  afterEach(() => {
    window.gtag = originalGtag;
  });

  it("returns false gracefully when window.gtag is not defined", () => {
    const result = trackEvent("cta_click", { button_name: "order_card" });
    expect(result).toBe(false);
  });

  it("calls window.gtag with event name and parameters when defined", () => {
    const mockGtag = vi.fn();
    window.gtag = mockGtag;

    const result = trackEvent("cta_click", {
      button_name: "order_card",
      category: "engagement",
    });

    expect(result).toBe(true);
    expect(mockGtag).toHaveBeenCalledTimes(1);
    expect(mockGtag).toHaveBeenCalledWith("event", "cta_click", {
      button_name: "order_card",
      category: "engagement",
    });
  });

  it("supports trackEvent without optional parameters", () => {
    const mockGtag = vi.fn();
    window.gtag = mockGtag;

    const result = trackEvent("page_view");

    expect(result).toBe(true);
    expect(mockGtag).toHaveBeenCalledWith("event", "page_view", undefined);
  });
});
