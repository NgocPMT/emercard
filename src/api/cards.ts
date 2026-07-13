import { z } from "zod";
import { requestJson } from "./http-client";

const cardStatusSchema = z.enum(["unassigned", "assigned", "active", "disabled", "lost", "replaced", "void"]);
const publicLinkPurposeSchema = z.enum(["card", "standalone"]);
const publicLinkStatusSchema = z.enum(["pending", "active", "disabled", "revoked", "expired"]);

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

const adminCardSchema = z
  .object({
    id: z.string(),
    serial: z.string(),
    status: cardStatusSchema,
    is_current: z.boolean(),
    encoding_state: z.enum(["not_provisioned", "link_generated", "verified"]),
    owner: z
      .object({
        id: z.string(),
        email: z.string(),
      })
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

const adminCardsResponseSchema = z.object({ items: z.array(adminCardSchema), next_cursor: z.string().nullable().optional() });

const linkProvisioningResponseSchema = z.object({
  link: publicLinkSummarySchema,
  public_token: z.string(),
  public_url: z.string(),
});

const linkListResponseSchema = z.object({ items: z.array(publicLinkSummarySchema) });

const provisioningResponseSchema = z.object({
  card: adminCardSchema,
  provisioning: z.object({ public_token: z.string(), public_url: z.string() }),
});

const adminCardResponseSchema = adminCardSchema;

export type UserCard = z.infer<typeof userCardSchema>;
export type AdminCard = z.infer<typeof adminCardSchema>;
export type PublicLinkSummary = z.infer<typeof publicLinkSummarySchema>;
export type CardAssignmentSummary = z.infer<typeof cardAssignmentSummarySchema>;
export type LinkProvisioningResponse = z.infer<typeof linkProvisioningResponseSchema>;
export type CardProvisioningResponse = z.infer<typeof provisioningResponseSchema>;
export type UserCardsResponse = z.infer<typeof userCardsResponseSchema>;
export type AdminCardsResponse = z.infer<typeof adminCardsResponseSchema>;
export type PublicLinkListResponse = z.infer<typeof linkListResponseSchema>;

export const cardKeys = {
  myCards: ["cards", "my"] as const,
  myLinks: ["links", "my"] as const,
  adminCards: ["cards", "admin"] as const,
  adminUserLinks: (userId: string) => ["links", "admin", userId] as const,
};

export async function getMyCards(signal?: AbortSignal): Promise<UserCardsResponse> {
  const response = await requestJson<unknown>({ path: "/me/cards", signal });
  return userCardsResponseSchema.parse(response);
}

export async function activateMyCard(cardId: string, signal?: AbortSignal): Promise<UserCard> {
  const response = await requestJson<unknown>({ path: `/me/cards/${encodeURIComponent(cardId)}/activate`, method: "POST", signal });
  return userCardSchema.parse(response);
}

export async function disableMyCard(cardId: string, signal?: AbortSignal): Promise<UserCard> {
  const response = await requestJson<unknown>({ path: `/me/cards/${encodeURIComponent(cardId)}/disable`, method: "POST", signal });
  return userCardSchema.parse(response);
}

export async function reportMyCardLost(cardId: string, signal?: AbortSignal): Promise<UserCard> {
  const response = await requestJson<unknown>({ path: `/me/cards/${encodeURIComponent(cardId)}/lost`, method: "POST", signal });
  return userCardSchema.parse(response);
}

export async function getAdminCards(signal?: AbortSignal): Promise<AdminCardsResponse> {
  const response = await requestJson<unknown>({ path: "/admin/cards", signal });
  return adminCardsResponseSchema.parse(response);
}

export async function createBlankCard(signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({ path: "/admin/cards", method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, signal });
  return adminCardResponseSchema.parse(response);
}

export async function provisionCardLink(cardId: string, signal?: AbortSignal): Promise<CardProvisioningResponse> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/provision-link`, method: "POST", signal });
  return provisioningResponseSchema.parse(response);
}

export async function listAdminUserLinks(userId: string, signal?: AbortSignal): Promise<PublicLinkListResponse> {
  const response = await requestJson<unknown>({ path: `/admin/users/${encodeURIComponent(userId)}/links`, signal });
  return linkListResponseSchema.parse(response);
}

export async function createAdminUserLink(
  userId: string,
  payload: { purpose: "card" | "standalone"; label?: string | null },
  signal?: AbortSignal,
): Promise<LinkProvisioningResponse> {
  const response = await requestJson<unknown>({
    path: `/admin/users/${encodeURIComponent(userId)}/links`,
    method: "POST",
    body: payload,
    signal,
  });
  return linkProvisioningResponseSchema.parse(response);
}

export async function getAdminCardLink(cardId: string, signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/link`, signal });
  return adminCardResponseSchema.parse(response);
}

export async function attachAdminCardLink(cardId: string, publicAccessLinkId: string, signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({
    path: `/admin/cards/${encodeURIComponent(cardId)}/link/attach`,
    method: "POST",
    body: { public_access_link_id: publicAccessLinkId },
    signal,
  });
  return adminCardResponseSchema.parse(response);
}

export async function detachAdminCardLink(cardId: string, reason?: string | null, signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({
    path: `/admin/cards/${encodeURIComponent(cardId)}/link/detach`,
    method: "POST",
    body: { reason: reason ?? null },
    signal,
  });
  return adminCardResponseSchema.parse(response);
}

export async function revokeAdminCardLink(cardId: string, reason?: string | null, signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({
    path: `/admin/cards/${encodeURIComponent(cardId)}/link/revoke`,
    method: "POST",
    body: { reason: reason ?? null },
    signal,
  });
  return adminCardResponseSchema.parse(response);
}

export async function reprovisionCardLink(cardId: string, signal?: AbortSignal): Promise<CardProvisioningResponse> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/reprovision-link`, method: "POST", signal });
  return provisioningResponseSchema.parse(response);
}

export async function confirmCardEncoding(cardId: string, publicUrl: string, signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/confirm-encoding`, method: "POST", body: { public_url: publicUrl }, signal });
  return adminCardResponseSchema.parse(response);
}

export async function assignCard(cardId: string, userId: string, signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/assign`, method: "POST", body: { user_id: userId }, signal });
  return adminCardResponseSchema.parse(response);
}

export async function reassignCard(cardId: string, newOwnerId: string, reason: "assignment_error" | "recipient_changed" | "internal_correction", signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/reassign`, method: "POST", body: { new_owner_id: newOwnerId, reason }, signal });
  return adminCardResponseSchema.parse(response);
}

export async function unassignCard(cardId: string, signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/unassign`, method: "POST", signal });
  return adminCardResponseSchema.parse(response);
}

export async function issueCard(cardId: string, signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/issue`, method: "POST", signal });
  return adminCardResponseSchema.parse(response);
}

export async function voidCard(cardId: string, signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/void`, method: "POST", signal });
  return adminCardResponseSchema.parse(response);
}

export async function reportAdminCardLost(cardId: string, signal?: AbortSignal): Promise<AdminCard> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/lost`, method: "POST", signal });
  return adminCardResponseSchema.parse(response);
}

export async function replaceCard(cardId: string, signal?: AbortSignal): Promise<CardProvisioningResponse> {
  const response = await requestJson<unknown>({ path: `/admin/cards/${encodeURIComponent(cardId)}/replace`, method: "POST", signal });
  return provisioningResponseSchema.parse(response);
}
