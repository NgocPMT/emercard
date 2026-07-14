import { beforeEach, describe, expect, it, vi } from "vitest";
import { profileMissingFieldLabel, profileReadinessLabel } from "./profile";

const requestJsonMock = vi.fn();

vi.mock("./http-client", async () => {
  const actual = await vi.importActual<typeof import("./http-client")>("./http-client");
  return {
    ...actual,
    requestJson: (...args: unknown[]) => requestJsonMock(...args),
  };
});

beforeEach(() => {
  requestJsonMock.mockReset();
});

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
