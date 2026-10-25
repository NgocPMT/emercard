import { describe, expect, it } from "vitest";
import { buildLoginRedirect, validateReturnTo } from ".";

describe("return-to validation", () => {
  it("allows relative app paths for users", () => {
    expect(validateReturnTo("/app/cards?tab=all", "user")).toBe("/app/cards?tab=all");
  });

  it("rejects external and emergency routes", () => {
    expect(validateReturnTo("https://evil.example", "user")).toBe("/app/profile");
    expect(validateReturnTo("/e/secret", "admin")).toBe("/admin");
  });

  it("falls back to the role home", () => {
    expect(validateReturnTo("/admin/cards", "user")).toBe("/app/profile");
    expect(validateReturnTo(undefined, "admin")).toBe("/admin");
  });

  it("builds safe login redirects", () => {
    expect(buildLoginRedirect("/app/profile", "user")).toBe("/login?returnTo=%2Fapp%2Fprofile");
  });
});
