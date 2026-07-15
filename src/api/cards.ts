import { z } from "zod";
import { requestJson } from "./http-client";

const cardStatusSchema = z.enum([
  "unassigned",
  "assigned",
  "active",
  "disabled",
  "lost",
  "replaced",
  "void",
]);
const publicLinkPurposeSchema = z.enum(["card", "standalone"]);
const publicLinkStatusSchema = z.enum([
  "pending",
  "active",
  "disabled",
  "revoked",
  "expired",
]);

const userCardSchema = z
  .object({
    id: z.string(),
    serial: z.string(),
    status: cardStatusSchema,
    is_current: z.boolean(),
    issued_at: z.string(),
    activated_at: z.string().nullable(),
    disabled_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    can_activate: z.boolean(),
    can_disable: z.boolean(),
    can_revoke: z.boolean(),
    can_report_lost: z.boolean(),
    blocking_reason: z.string().nullable().optional(),
    link_status: publicLinkStatusSchema.nullable().optional(),
    link_purpose: publicLinkPurposeSchema.nullable().optional(),
    link_label: z.string().nullable().optional(),
  })
  .passthrough();

const userCardsResponseSchema = z.object({ cards: z.array(userCardSchema) });

const publicLinkSummarySchema = z
  .object({
    id: z.string(),
    purpose: publicLinkPurposeSchema,
    label: z.string().nullable().optional(),
    status: publicLinkStatusSchema,
    created_at: z.string(),
    updated_at: z.string(),
    activated_at: z.string().nullable().optional(),
    disabled_at: z.string().nullable().optional(),
    revoked_at: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    expired_at: z.string().nullable().optional(),
  })
  .passthrough();

const cardAssignmentSummarySchema = z
  .object({
    id: z.string(),
    status: z.enum(["active", "disabled", "detached"]),
    attached_at: z.string(),
    updated_at: z.string(),
    detached_at: z.string().nullable().optional(),
    detach_reason: z.string().nullable().optional(),
  })
  .passthrough();

const safeUserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    role: z.enum(["user", "admin"]),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();
const safeUserListResponseSchema = z.object({
  items: z.array(safeUserSchema),
});

const adminCardSchema = z
  .object({
    id: z.string(),
    serial: z.string(),
    status: cardStatusSchema,
    is_current: z.boolean(),
    encoding_state: z.enum(["not_provisioned", "link_generated", "verified"]),
    owner: z
      .object({ id: z.string(), email: z.string() })
      .nullable()
      .optional(),
    link: publicLinkSummarySchema.nullable().optional(),
    assignment: cardAssignmentSummarySchema.nullable().optional(),
    provisioned_at: z.string().nullable().optional(),
    encoding_verified_at: z.string().nullable().optional(),
    assigned_at: z.string().nullable().optional(),
    issued_at: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

const adminCardsResponseSchema = z.object({
  items: z.array(adminCardSchema),
  next_cursor: z.string().nullable().optional(),
});
const linkProvisioningResponseSchema = z.object({
  link: publicLinkSummarySchema,
  public_token: z.string(),
  public_url: z.string(),
});
const linkListResponseSchema = z.object({
  items: z.array(publicLinkSummarySchema),
});
const adminCardResponseSchema = adminCardSchema;

export type UserCard = z.infer<typeof userCardSchema>;
export type AdminCard = z.infer<typeof adminCardSchema>;
export type PublicLinkSummary = z.infer<typeof publicLinkSummarySchema>;
export type CardAssignmentSummary = z.infer<typeof cardAssignmentSummarySchema>;
export type LinkProvisioningResponse = z.infer<
  typeof linkProvisioningResponseSchema
>;
export type UserCardsResponse = z.infer<typeof userCardsResponseSchema>;
export type AdminCardsResponse = z.infer<typeof adminCardsResponseSchema>;
export type PublicLinkListResponse = z.infer<typeof linkListResponseSchema>;
export type SafeUser = z.infer<typeof safeUserSchema>;
export type SafeUserListResponse = z.infer<typeof safeUserListResponseSchema>;

export const cardKeys = {
  myCards: ["cards", "my"] as const,
  myCard: (cardId: string) => ["cards", "my", cardId] as const,
  adminCards: ["cards", "admin"] as const,
  adminCard: (cardId: string) => ["cards", "admin", cardId] as const,
  adminUsers: (search = "") =>
    ["users", "admin", "list", search.trim().toLowerCase()] as const,
  adminUserLookup: (email: string) =>
    ["users", "admin", "lookup", email.trim().toLowerCase()] as const,
  adminUserLinks: (userId: string) => ["links", "admin", userId] as const,
};

export async function getMyCards(
  signal?: AbortSignal,
): Promise<UserCardsResponse> {
  return userCardsResponseSchema.parse(
    await requestJson<unknown>({ path: "/me/cards", signal }),
  );
}

async function userCardMutation(
  cardId: string,
  action: "activate" | "disable" | "revoke" | "lost",
  signal?: AbortSignal,
): Promise<UserCard> {
  return userCardSchema.parse(
    await requestJson<unknown>({
      path: `/me/cards/${encodeURIComponent(cardId)}/${action}`,
      method: "POST",
      signal,
    }),
  );
}

export const activateMyCard = (cardId: string, signal?: AbortSignal) =>
  userCardMutation(cardId, "activate", signal);
export const disableMyCard = (cardId: string, signal?: AbortSignal) =>
  userCardMutation(cardId, "disable", signal);
export const revokeMyCard = (cardId: string, signal?: AbortSignal) =>
  userCardMutation(cardId, "revoke", signal);
export const reportMyCardLost = (cardId: string, signal?: AbortSignal) =>
  userCardMutation(cardId, "lost", signal);

export async function getAdminCards(
  signal?: AbortSignal,
): Promise<AdminCardsResponse> {
  return adminCardsResponseSchema.parse(
    await requestJson<unknown>({ path: "/admin/cards", signal }),
  );
}

export async function createBlankCard(
  signal?: AbortSignal,
): Promise<AdminCard> {
  return adminCardResponseSchema.parse(
    await requestJson<unknown>({
      path: "/admin/cards",
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      signal,
    }),
  );
}

export async function listAdminUsers(
  search = "",
  signal?: AbortSignal,
): Promise<SafeUserListResponse> {
  const params = new URLSearchParams({ limit: "100" });
  if (search.trim()) params.set("search", search.trim());
  return safeUserListResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/users?${params.toString()}`,
      signal,
    }),
  );
}

export async function lookupAdminUserByEmail(
  email: string,
  signal?: AbortSignal,
): Promise<SafeUser> {
  return safeUserSchema.parse(
    await requestJson<unknown>({
      path: `/admin/users/lookup?email=${encodeURIComponent(email.trim())}`,
      signal,
    }),
  );
}

export async function listAdminUserLinks(
  userId: string,
  signal?: AbortSignal,
): Promise<PublicLinkListResponse> {
  return linkListResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/users/${encodeURIComponent(userId)}/links`,
      signal,
    }),
  );
}

export async function createAdminUserLink(
  userId: string,
  payload: { label?: string | null },
  signal?: AbortSignal,
): Promise<LinkProvisioningResponse> {
  return linkProvisioningResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/users/${encodeURIComponent(userId)}/links`,
      method: "POST",
      body: { purpose: "card", label: payload.label ?? null },
      signal,
    }),
  );
}

export async function getAdminCard(
  cardId: string,
  signal?: AbortSignal,
): Promise<AdminCard> {
  return adminCardResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards/${encodeURIComponent(cardId)}`,
      signal,
    }),
  );
}

export async function attachAdminCardLink(
  cardId: string,
  publicAccessLinkId: string,
  signal?: AbortSignal,
): Promise<AdminCard> {
  return adminCardResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards/${encodeURIComponent(cardId)}/link/attach`,
      method: "POST",
      body: { public_access_link_id: publicAccessLinkId },
      signal,
    }),
  );
}

export async function confirmCardEncoding(
  cardId: string,
  publicUrl: string,
  signal?: AbortSignal,
): Promise<AdminCard> {
  return adminCardResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards/${encodeURIComponent(cardId)}/confirm-encoding`,
      method: "POST",
      body: { public_url: publicUrl },
      signal,
    }),
  );
}

async function adminCardMutation(
  cardId: string,
  action:
    "activate" | "disable" | "revoke" | "issue" | "void" | "lost" | "replace",
  signal?: AbortSignal,
) {
  const response = await requestJson<unknown>({
    path: `/admin/cards/${encodeURIComponent(cardId)}/${action}`,
    method: "POST",
    signal,
  });
  return action === "replace"
    ? z
        .object({
          card: adminCardSchema,
          provisioning: z.object({
            public_token: z.string(),
            public_url: z.string(),
          }),
        })
        .parse(response).card
    : adminCardResponseSchema.parse(response);
}

export const issueCard = (cardId: string, signal?: AbortSignal) =>
  adminCardMutation(cardId, "issue", signal);
export const voidCard = (cardId: string, signal?: AbortSignal) =>
  adminCardMutation(cardId, "void", signal);
export const reportAdminCardLost = (cardId: string, signal?: AbortSignal) =>
  adminCardMutation(cardId, "lost", signal);
export const replaceCard = (cardId: string, signal?: AbortSignal) =>
  adminCardMutation(cardId, "replace", signal);

export async function activateAdminCardLink(
  cardId: string,
  signal?: AbortSignal,
): Promise<AdminCard> {
  return adminCardResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards/${encodeURIComponent(cardId)}/link/activate`,
      method: "POST",
      signal,
    }),
  );
}

export async function disableAdminCardLink(
  cardId: string,
  signal?: AbortSignal,
): Promise<AdminCard> {
  return adminCardResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards/${encodeURIComponent(cardId)}/link/disable`,
      method: "POST",
      signal,
    }),
  );
}

export async function revokeAdminCardLink(
  cardId: string,
  reason?: string | null,
  signal?: AbortSignal,
): Promise<AdminCard> {
  return adminCardResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards/${encodeURIComponent(cardId)}/link/revoke`,
      method: "POST",
      body: { reason: reason ?? null },
      signal,
    }),
  );
}
