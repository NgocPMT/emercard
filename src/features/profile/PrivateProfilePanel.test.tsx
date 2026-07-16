import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivateProfilePanel } from "./PrivateProfilePanel";
import type { PrivateProfileEnvelope } from "../../api/profile";

const authorizeMock = vi.fn();
const createEnvelopeMock = vi.fn();

vi.mock("../../api/profile", () => ({
  authorizePrivateProfileWrite: (...args: unknown[]) => authorizeMock(...args),
}));

vi.mock("../../lib/private-profile-crypto", () => ({
  createPrivateProfileEnvelope: (...args: unknown[]) =>
    createEnvelopeMock(...args),
  decryptPrivateProfileWithAccessCode: vi.fn(),
  decryptPrivateProfileWithRecoveryKey: vi.fn(),
  replacePrivateProfilePayload: vi.fn(),
  resetAccessCodeWithRecoveryKey: vi.fn(),
  resetRecoveryKeyWithAccessCode: vi.fn(),
}));

const envelope = {
  version: 1,
  kdf: {
    algorithm: "argon2id",
    salt: "salt",
    memory_cost_kib: 65_536,
    time_cost: 3,
    parallelism: 1,
  },
  nonce: "nonce",
  ciphertext: "ciphertext",
  access_code_wrap: {
    algorithm: "aes-256-gcm",
    nonce: "nonce",
    ciphertext: "ciphertext",
  },
  recovery_key_wrap: {
    algorithm: "aes-256-gcm",
    nonce: "nonce",
    ciphertext: "ciphertext",
  },
} as PrivateProfileEnvelope;

beforeEach(() => {
  authorizeMock.mockReset();
  createEnvelopeMock.mockReset();
  authorizeMock.mockResolvedValue({
    authorization_token: "authorization-token",
    expires_at: "2026-01-01T00:00:00Z",
    purpose: "private_profile_write",
  });
  createEnvelopeMock.mockResolvedValue({
    envelope,
    recoveryKey: "abcd-abcd-abcd-abcd",
  });
});

describe("PrivateProfilePanel", () => {
  it("rejects access codes shorter than ten characters", async () => {
    const user = userEvent.setup();
    render(
      <PrivateProfilePanel
        profileId="profile-1"
        envelope={null}
        onPendingChange={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Mã truy cập"), "123456789");
    await user.type(screen.getByLabelText("Nhập lại mã truy cập"), "123456789");
    await user.click(
      screen.getByRole("button", { name: "Tạo thông tin riêng tư" }),
    );

    expect(
      await screen.findByText("Mã truy cập phải có ít nhất 10 ký tự."),
    ).toBeInTheDocument();
    expect(createEnvelopeMock).not.toHaveBeenCalled();
  });

  it("shows the generated recovery key once and never writes secrets to storage", async () => {
    const user = userEvent.setup();
    const onPendingChange = vi.fn();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(
      <PrivateProfilePanel
        profileId="profile-1"
        envelope={null}
        onPendingChange={onPendingChange}
      />,
    );

    await user.type(screen.getByLabelText("Mã truy cập"), "correct horse");
    await user.type(
      screen.getByLabelText("Nhập lại mã truy cập"),
      "correct horse",
    );
    await user.type(
      screen.getByLabelText("Mật khẩu tài khoản để xác nhận"),
      "account-password",
    );
    await user.click(
      screen.getByRole("button", { name: "Tạo thông tin riêng tư" }),
    );

    expect(await screen.findByTestId("recovery-key-notice")).toHaveTextContent(
      "abcd-abcd-abcd-abcd",
    );
    expect(setItem).not.toHaveBeenCalled();
    expect(onPendingChange).toHaveBeenLastCalledWith({
      envelope,
      authorizationToken: "authorization-token",
      ready: false,
    });

    await user.click(screen.getByLabelText(/Tôi đã lưu khóa khôi phục/));
    expect(onPendingChange).toHaveBeenLastCalledWith({
      envelope,
      authorizationToken: "authorization-token",
      ready: true,
    });
    setItem.mockRestore();
  });
});
