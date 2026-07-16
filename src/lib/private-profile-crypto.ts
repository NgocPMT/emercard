import { argon2id } from "hash-wasm";
import { z } from "zod";

const VERSION = 1 as const;
const ARGON2_MEMORY_COST_KIB = 65_536;
const ARGON2_TIME_COST = 3;
const ARGON2_PARALLELISM = 1;
const ARGON2_KEY_LENGTH = 32;
const AES_KEY_LENGTH = 32;
const AES_NONCE_LENGTH = 12;
const SALT_LENGTH = 16;
const AAD_PREFIX = "emercard-private-profile:v1:";

const base64UrlSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid encoded bytes");
const kdfSchema = z
  .object({
    algorithm: z.literal("argon2id"),
    salt: base64UrlSchema,
    memory_cost_kib: z.number().int().min(8_192).max(1_048_576),
    time_cost: z.number().int().min(1).max(20),
    parallelism: z.number().int().min(1).max(32),
  })
  .strict();
const keyWrapSchema = z
  .object({
    algorithm: z.literal("aes-256-gcm"),
    nonce: base64UrlSchema,
    ciphertext: base64UrlSchema,
  })
  .strict();

export const privateProfileEnvelopeSchema = z
  .object({
    version: z.literal(VERSION),
    kdf: kdfSchema,
    nonce: base64UrlSchema,
    ciphertext: base64UrlSchema,
    access_code_wrap: keyWrapSchema,
    recovery_key_wrap: keyWrapSchema,
  })
  .strict();

export const privateProfilePayloadSchema = z
  .object({
    address: z.string().max(2_000),
    citizen_id: z.string().max(256),
    sensitive_conditions: z.array(z.string().max(500)).max(100),
  })
  .strict();

export type PrivateProfileEnvelope = z.infer<
  typeof privateProfileEnvelopeSchema
>;
export type PrivateProfilePayload = z.infer<typeof privateProfilePayloadSchema>;
export type PrivateProfileKdf = z.infer<typeof kdfSchema>;

export class PrivateProfileCryptoError extends Error {
  constructor() {
    super("Không thể mở khóa thông tin riêng tư.");
    this.name = "PrivateProfileCryptoError";
  }
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8_000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(value: string) {
  const padded =
    value.replaceAll("-", "+").replaceAll("_", "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function decodeHex(value: string) {
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new PrivateProfileCryptoError();
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1)
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function formatRecoveryKey(bytes: Uint8Array) {
  const hex = encodeHex(bytes);
  return hex.match(/.{1,4}/g)?.join("-") ?? hex;
}

function normalizeRecoveryKey(value: string) {
  return value.replaceAll(/[\s-]/g, "").toLowerCase();
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

function aadBytes(
  profileId: string,
  purpose: "payload" | "access-code" | "recovery-key",
) {
  if (!profileId.trim()) throw new PrivateProfileCryptoError();
  return textBytes(`${AAD_PREFIX}${profileId}:${purpose}`);
}

function asArrayBuffer(bytes: Uint8Array) {
  return new Uint8Array(bytes).buffer as ArrayBuffer;
}

function wipe(bytes: Uint8Array | undefined) {
  bytes?.fill(0);
}

async function deriveKey(
  secret: string,
  salt: Uint8Array,
  kdf: PrivateProfileKdf,
) {
  if (!secret) throw new PrivateProfileCryptoError();
  return argon2id({
    password: secret,
    salt,
    iterations: kdf.time_cost,
    parallelism: kdf.parallelism,
    memorySize: kdf.memory_cost_kib,
    hashLength: ARGON2_KEY_LENGTH,
    outputType: "binary",
  });
}

async function importAesKey(rawKey: Uint8Array, usages: KeyUsage[]) {
  return globalThis.crypto.subtle.importKey(
    "raw",
    asArrayBuffer(rawKey),
    { name: "AES-GCM" },
    false,
    usages,
  );
}

async function encryptBytes(
  rawKey: Uint8Array,
  plaintext: Uint8Array,
  additionalData: Uint8Array,
) {
  const nonce = randomBytes(AES_NONCE_LENGTH);
  const key = await importAesKey(rawKey, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(nonce),
        additionalData: asArrayBuffer(additionalData),
      },
      key,
      asArrayBuffer(plaintext),
    ),
  );
  return { nonce, ciphertext };
}

async function decryptBytes(
  rawKey: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  additionalData: Uint8Array,
) {
  const key = await importAesKey(rawKey, ["decrypt"]);
  return new Uint8Array(
    await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(nonce),
        additionalData: asArrayBuffer(additionalData),
      },
      key,
      asArrayBuffer(ciphertext),
    ),
  );
}

function keyWrapFrom(nonce: Uint8Array, ciphertext: Uint8Array) {
  return {
    algorithm: "aes-256-gcm" as const,
    nonce: encodeBase64Url(nonce),
    ciphertext: encodeBase64Url(ciphertext),
  };
}

async function wrapDataKey(
  rawKey: Uint8Array,
  dataKey: Uint8Array,
  additionalData: Uint8Array,
) {
  const result = await encryptBytes(rawKey, dataKey, additionalData);
  return keyWrapFrom(result.nonce, result.ciphertext);
}

async function unwrapDataKey(
  rawKey: Uint8Array,
  wrap: z.infer<typeof keyWrapSchema>,
  additionalData: Uint8Array,
) {
  const plaintext = await decryptBytes(
    rawKey,
    decodeBase64Url(wrap.nonce),
    decodeBase64Url(wrap.ciphertext),
    additionalData,
  );
  if (plaintext.length !== AES_KEY_LENGTH) {
    wipe(plaintext);
    throw new PrivateProfileCryptoError();
  }
  return plaintext;
}

function kdfFrom(salt: Uint8Array): PrivateProfileKdf {
  return {
    algorithm: "argon2id",
    salt: encodeBase64Url(salt),
    memory_cost_kib: ARGON2_MEMORY_COST_KIB,
    time_cost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
  };
}

function normalizedPayload(payload: PrivateProfilePayload) {
  return privateProfilePayloadSchema.parse({
    address: payload.address.trim(),
    citizen_id: payload.citizen_id.trim(),
    sensitive_conditions: payload.sensitive_conditions
      .map((condition) => condition.trim())
      .filter(Boolean),
  });
}

function assertAccessCode(accessCode: string) {
  if (accessCode.length < 10) throw new PrivateProfileCryptoError();
}

async function unwrapWithSecret(
  envelope: PrivateProfileEnvelope,
  profileId: string,
  secret: string,
  wrap: "access_code_wrap" | "recovery_key_wrap",
) {
  const parsed = privateProfileEnvelopeSchema.parse(envelope);
  const salt = decodeBase64Url(parsed.kdf.salt);
  const derivedKey = await deriveKey(secret, salt, parsed.kdf);
  try {
    return await unwrapDataKey(
      derivedKey,
      parsed[wrap],
      aadBytes(
        profileId,
        wrap === "access_code_wrap" ? "access-code" : "recovery-key",
      ),
    );
  } finally {
    wipe(derivedKey);
    wipe(salt);
  }
}

async function decryptWithDataKey(
  envelope: PrivateProfileEnvelope,
  profileId: string,
  dataKey: Uint8Array,
) {
  const plaintext = await decryptBytes(
    dataKey,
    decodeBase64Url(envelope.nonce),
    decodeBase64Url(envelope.ciphertext),
    aadBytes(profileId, "payload"),
  );
  try {
    return privateProfilePayloadSchema.parse(
      JSON.parse(new TextDecoder().decode(plaintext)),
    );
  } finally {
    wipe(plaintext);
  }
}

export async function createPrivateProfileEnvelope(
  profileId: string,
  accessCode: string,
  payload: PrivateProfilePayload,
): Promise<{ envelope: PrivateProfileEnvelope; recoveryKey: string }> {
  assertAccessCode(accessCode);
  const normalized = normalizedPayload(payload);
  const salt = randomBytes(SALT_LENGTH);
  const dataKey = randomBytes(AES_KEY_LENGTH);
  const recoveryKeyBytes = randomBytes(AES_KEY_LENGTH);
  const kdf = kdfFrom(salt);
  const payloadBytes = textBytes(JSON.stringify(normalized));
  let accessKey: Uint8Array | undefined;
  let recoveryKey: Uint8Array | undefined;
  try {
    accessKey = await deriveKey(accessCode, salt, kdf);
    recoveryKey = await deriveKey(encodeHex(recoveryKeyBytes), salt, kdf);
    const encryptedPayload = await encryptBytes(
      dataKey,
      payloadBytes,
      aadBytes(profileId, "payload"),
    );
    const accessWrap = await wrapDataKey(
      accessKey,
      dataKey,
      aadBytes(profileId, "access-code"),
    );
    const recoveryWrap = await wrapDataKey(
      recoveryKey,
      dataKey,
      aadBytes(profileId, "recovery-key"),
    );
    return {
      envelope: {
        version: VERSION,
        kdf,
        nonce: encodeBase64Url(encryptedPayload.nonce),
        ciphertext: encodeBase64Url(encryptedPayload.ciphertext),
        access_code_wrap: accessWrap,
        recovery_key_wrap: recoveryWrap,
      },
      recoveryKey: formatRecoveryKey(recoveryKeyBytes),
    };
  } catch {
    throw new PrivateProfileCryptoError();
  } finally {
    wipe(salt);
    wipe(dataKey);
    wipe(recoveryKeyBytes);
    wipe(accessKey);
    wipe(recoveryKey);
    wipe(payloadBytes);
  }
}

export async function decryptPrivateProfileWithAccessCode(
  envelope: PrivateProfileEnvelope,
  profileId: string,
  accessCode: string,
) {
  assertAccessCode(accessCode);
  try {
    const dataKey = await unwrapWithSecret(
      envelope,
      profileId,
      accessCode,
      "access_code_wrap",
    );
    try {
      return await decryptWithDataKey(envelope, profileId, dataKey);
    } finally {
      wipe(dataKey);
    }
  } catch {
    throw new PrivateProfileCryptoError();
  }
}

export async function decryptPrivateProfileWithRecoveryKey(
  envelope: PrivateProfileEnvelope,
  profileId: string,
  recoveryKey: string,
) {
  const normalizedKey = normalizeRecoveryKey(recoveryKey);
  const recoveryKeyBytes = decodeHex(normalizedKey);
  try {
    const dataKey = await unwrapWithSecret(
      envelope,
      profileId,
      encodeHex(recoveryKeyBytes),
      "recovery_key_wrap",
    );
    try {
      return await decryptWithDataKey(envelope, profileId, dataKey);
    } finally {
      wipe(dataKey);
    }
  } catch {
    throw new PrivateProfileCryptoError();
  } finally {
    wipe(recoveryKeyBytes);
  }
}

export async function replacePrivateProfilePayload(
  envelope: PrivateProfileEnvelope,
  profileId: string,
  accessCode: string,
  payload: PrivateProfilePayload,
) {
  assertAccessCode(accessCode);
  const parsed = privateProfileEnvelopeSchema.parse(envelope);
  const normalized = normalizedPayload(payload);
  let dataKey: Uint8Array | undefined;
  const payloadBytes = textBytes(JSON.stringify(normalized));
  try {
    dataKey = await unwrapWithSecret(
      parsed,
      profileId,
      accessCode,
      "access_code_wrap",
    );
    const encryptedPayload = await encryptBytes(
      dataKey,
      payloadBytes,
      aadBytes(profileId, "payload"),
    );
    return {
      ...parsed,
      nonce: encodeBase64Url(encryptedPayload.nonce),
      ciphertext: encodeBase64Url(encryptedPayload.ciphertext),
    };
  } catch {
    throw new PrivateProfileCryptoError();
  } finally {
    wipe(dataKey);
    wipe(payloadBytes);
  }
}

export async function resetAccessCodeWithRecoveryKey(
  envelope: PrivateProfileEnvelope,
  profileId: string,
  recoveryKey: string,
  newAccessCode: string,
) {
  assertAccessCode(newAccessCode);
  const parsed = privateProfileEnvelopeSchema.parse(envelope);
  const normalizedKey = normalizeRecoveryKey(recoveryKey);
  const recoveryKeyBytes = decodeHex(normalizedKey);
  const salt = decodeBase64Url(parsed.kdf.salt);
  let dataKey: Uint8Array | undefined;
  let accessKey: Uint8Array | undefined;
  try {
    dataKey = await unwrapWithSecret(
      parsed,
      profileId,
      encodeHex(recoveryKeyBytes),
      "recovery_key_wrap",
    );
    accessKey = await deriveKey(newAccessCode, salt, parsed.kdf);
    return {
      ...parsed,
      access_code_wrap: await wrapDataKey(
        accessKey,
        dataKey,
        aadBytes(profileId, "access-code"),
      ),
    };
  } catch {
    throw new PrivateProfileCryptoError();
  } finally {
    wipe(recoveryKeyBytes);
    wipe(salt);
    wipe(dataKey);
    wipe(accessKey);
  }
}

export async function resetRecoveryKeyWithAccessCode(
  envelope: PrivateProfileEnvelope,
  profileId: string,
  accessCode: string,
) {
  assertAccessCode(accessCode);
  const parsed = privateProfileEnvelopeSchema.parse(envelope);
  const salt = decodeBase64Url(parsed.kdf.salt);
  const newRecoveryKeyBytes = randomBytes(AES_KEY_LENGTH);
  let dataKey: Uint8Array | undefined;
  let accessKey: Uint8Array | undefined;
  let recoveryKey: Uint8Array | undefined;
  try {
    dataKey = await unwrapWithSecret(
      parsed,
      profileId,
      accessCode,
      "access_code_wrap",
    );
    accessKey = await deriveKey(accessCode, salt, parsed.kdf);
    recoveryKey = await deriveKey(
      encodeHex(newRecoveryKeyBytes),
      salt,
      parsed.kdf,
    );
    return {
      envelope: {
        ...parsed,
        recovery_key_wrap: await wrapDataKey(
          recoveryKey,
          dataKey,
          aadBytes(profileId, "recovery-key"),
        ),
      },
      recoveryKey: formatRecoveryKey(newRecoveryKeyBytes),
    };
  } catch {
    throw new PrivateProfileCryptoError();
  } finally {
    wipe(salt);
    wipe(newRecoveryKeyBytes);
    wipe(dataKey);
    wipe(accessKey);
    wipe(recoveryKey);
  }
}

export function privateProfileEnvelopeHasValidShape(
  value: unknown,
): value is PrivateProfileEnvelope {
  return privateProfileEnvelopeSchema.safeParse(value).success;
}
