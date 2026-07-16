import { describe, expect, it } from "vitest";
import {
  createPrivateProfileEnvelope,
  decryptPrivateProfileWithAccessCode,
  decryptPrivateProfileWithRecoveryKey,
  privateProfileEnvelopeHasValidShape,
  resetAccessCodeWithRecoveryKey,
  resetRecoveryKeyWithAccessCode,
  type PrivateProfilePayload,
} from "./private-profile-crypto";

const profileId = "profile-123";
const accessCode = "correct horse battery staple";
const payload: PrivateProfilePayload = {
  address: "12 Example Street",
  citizen_id: "012345678901",
  sensitive_conditions: ["Epilepsy", "Requires quiet environment"],
};

describe("private profile crypto", () => {
  it("round-trips with the access code and recovery key without serializing plaintext", async () => {
    const result = await createPrivateProfileEnvelope(
      profileId,
      accessCode,
      payload,
    );
    const serialized = JSON.stringify(result.envelope);

    expect(privateProfileEnvelopeHasValidShape(result.envelope)).toBe(true);
    expect(serialized).not.toContain(payload.address);
    expect(serialized).not.toContain(payload.citizen_id);
    expect(serialized).not.toContain(accessCode);
    expect(serialized).not.toContain(result.recoveryKey);
    await expect(
      decryptPrivateProfileWithAccessCode(
        result.envelope,
        profileId,
        accessCode,
      ),
    ).resolves.toEqual(payload);
    await expect(
      decryptPrivateProfileWithRecoveryKey(
        result.envelope,
        profileId,
        result.recoveryKey,
      ),
    ).resolves.toEqual(payload);
  }, 30_000);

  it("rejects wrong codes, wrong AAD context, and tampered ciphertext generically", async () => {
    const result = await createPrivateProfileEnvelope(
      profileId,
      accessCode,
      payload,
    );
    const tampered = {
      ...result.envelope,
      ciphertext: `${result.envelope.ciphertext.startsWith("A") ? "B" : "A"}${result.envelope.ciphertext.slice(1)}`,
    };

    await expect(
      decryptPrivateProfileWithAccessCode(
        result.envelope,
        profileId,
        "wrong access code",
      ),
    ).rejects.toThrow("Không thể mở khóa thông tin riêng tư.");
    await expect(
      decryptPrivateProfileWithAccessCode(
        result.envelope,
        "another-profile",
        accessCode,
      ),
    ).rejects.toThrow("Không thể mở khóa thông tin riêng tư.");
    await expect(
      decryptPrivateProfileWithAccessCode(tampered, profileId, accessCode),
    ).rejects.toThrow("Không thể mở khóa thông tin riêng tư.");
  }, 30_000);

  it("allows the recovery key to replace the access code while preserving the data", async () => {
    const result = await createPrivateProfileEnvelope(
      profileId,
      accessCode,
      payload,
    );
    const replacement = await resetAccessCodeWithRecoveryKey(
      result.envelope,
      profileId,
      result.recoveryKey,
      "new access code 123",
    );

    await expect(
      decryptPrivateProfileWithAccessCode(
        replacement,
        profileId,
        "new access code 123",
      ),
    ).resolves.toEqual(payload);
    await expect(
      decryptPrivateProfileWithAccessCode(replacement, profileId, accessCode),
    ).rejects.toThrow();
    await expect(
      decryptPrivateProfileWithRecoveryKey(
        replacement,
        profileId,
        result.recoveryKey,
      ),
    ).resolves.toEqual(payload);
  }, 30_000);

  it("can rotate the recovery key with the access code", async () => {
    const result = await createPrivateProfileEnvelope(
      profileId,
      accessCode,
      payload,
    );
    const replacement = await resetRecoveryKeyWithAccessCode(
      result.envelope,
      profileId,
      accessCode,
    );

    await expect(
      decryptPrivateProfileWithRecoveryKey(
        replacement.envelope,
        profileId,
        replacement.recoveryKey,
      ),
    ).resolves.toEqual(payload);
    await expect(
      decryptPrivateProfileWithRecoveryKey(
        replacement.envelope,
        profileId,
        result.recoveryKey,
      ),
    ).rejects.toThrow();
  }, 30_000);
});
