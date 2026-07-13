import { describe, expect, it } from "vitest";
import { profileMissingFieldLabel, profileReadinessLabel } from "./profile";

describe("profile api helpers", () => {
  it("maps readiness status labels", () => {
    expect(profileReadinessLabel("not_started")).toBe("Chưa bắt đầu");
    expect(profileReadinessLabel("incomplete")).toBe("Chưa hoàn thiện");
    expect(profileReadinessLabel("ready")).toBe("Sẵn sàng");
  });

  it("maps missing fields to friendly labels", () => {
    expect(profileMissingFieldLabel("display_name")).toBe("Tên hiển thị");
    expect(profileMissingFieldLabel("emergency_contacts")).toBe("Người liên hệ khẩn cấp");
    expect(profileMissingFieldLabel("other")).toBe("other");
  });
});
