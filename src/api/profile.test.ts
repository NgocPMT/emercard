import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPublicPreviewLink,
  disablePublicPreviewLink,
  generatePublicPreviewLink,
  profileMissingFieldLabel,
  profileReadinessLabel,
  regeneratePublicPreviewLink,
} from "./profile";

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

  it("creates and manages standalone preview links", async () => {
    requestJsonMock.mockResolvedValueOnce({ public_url: "https://app.example/e/demo-token" });
    await expect(createPublicPreviewLink()).resolves.toEqual({ public_url: "https://app.example/e/demo-token" });
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/me/profile/public-preview-link", method: "POST" }),
    );

    requestJsonMock.mockResolvedValueOnce({ action: "generate", status: "active", public_url: "https://app.example/e/link-1" });
    await expect(generatePublicPreviewLink()).resolves.toMatchObject({ action: "generate", status: "active" });
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/me/profile/public-preview-link/generate", method: "POST" }),
    );

    requestJsonMock.mockResolvedValueOnce({ action: "regenerate", status: "active", public_url: "https://app.example/e/link-2" });
    await expect(regeneratePublicPreviewLink()).resolves.toMatchObject({ action: "regenerate", status: "active" });

    requestJsonMock.mockResolvedValueOnce({ action: "disable", status: "disabled", public_url: null });
    await expect(disablePublicPreviewLink()).resolves.toMatchObject({ action: "disable", status: "disabled" });
  });
});
