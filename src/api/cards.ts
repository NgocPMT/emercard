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
    batch_id: z.string().nullable().optional(),
    chip_type: z.string().nullable().optional(),
    hardware_uid: z.string().nullable().optional(),
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
const linkAccessEventSchema = z.object({
  id: z.string(),
  accessed_at: z.string(),
  device: z.string().nullable().optional(),
  latency_ms: z.number().nullable().optional(),
});
const linkAccessHistoryResponseSchema = z.object({
  items: z.array(linkAccessEventSchema),
  next_cursor: z.string().nullable().optional(),
  scans_this_month: z.number().nullable().optional(),
  average_latency_ms: z.number().nullable().optional(),
});
const adminCardResponseSchema = adminCardSchema;

const cardInventoryStatsSchema = z.object({
  total: z.number(),
  active: z.number(),
  available: z.number(),
  suspended: z.number(),
  lost: z.number(),
  void: z.number(),
});

const batchCardProvisionResponseSchema = z.object({
  batch_id: z.string(),
  chip_type: z.string(),
  quantity: z.number(),
  serial_start: z.string(),
  serial_end: z.string(),
  cards: z.array(adminCardSchema),
});

const custodyEventSchema = z.object({
  id: z.string(),
  card_id: z.string(),
  card_serial: z.string(),
  event_type: z.string(),
  previous_owner_id: z.string().nullable().optional(),
  new_owner_id: z.string().nullable().optional(),
  performed_by_admin_id: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  created_at: z.string(),
});

const custodyEventListResponseSchema = z.object({
  items: z.array(custodyEventSchema),
});

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
export type LinkAccessEvent = z.infer<typeof linkAccessEventSchema>;
export type LinkAccessHistoryResponse = z.infer<typeof linkAccessHistoryResponseSchema>;
export type SafeUser = z.infer<typeof safeUserSchema>;
export type SafeUserListResponse = z.infer<typeof safeUserListResponseSchema>;
export type CardInventoryStats = z.infer<typeof cardInventoryStatsSchema>;
export type BatchCardProvisionResponse = z.infer<
  typeof batchCardProvisionResponseSchema
>;
export type CustodyEvent = z.infer<typeof custodyEventSchema>;
export type CustodyEventListResponse = z.infer<
  typeof custodyEventListResponseSchema
>;

export const cardKeys = {
  myCards: ["cards", "my"] as const,
  myCard: (cardId: string) => ["cards", "my", cardId] as const,
  myCardAccessHistory: (cardId: string) => ["cards", "my", cardId, "access-history"] as const,
  adminCards: ["cards", "admin"] as const,
  adminCardList: (filters?: { search?: string; status?: string }) =>
    [
      "cards",
      "admin",
      "list",
      filters?.search?.trim().toLowerCase() ?? "",
      filters?.status ?? "all",
    ] as const,
  adminStats: ["cards", "admin", "stats"] as const,
  adminCustodyEvents: (limit?: number) =>
    ["cards", "admin", "custody-events", limit ?? 20] as const,
  adminCard: (cardId: string) => ["cards", "admin", cardId] as const,
  adminUsers: (search = "") =>
    ["users", "admin", "list", search.trim().toLowerCase()] as const,
  adminUserLookup: (email: string) =>
    ["users", "admin", "lookup", email.trim().toLowerCase()] as const,
  adminUserLinks: (userId: string) => ["links", "admin", userId] as const,
};

export async function getMyCardAccessHistory(
  cardId: string,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<LinkAccessHistoryResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return linkAccessHistoryResponseSchema.parse(
    await requestJson<unknown>({
      path: `/me/cards/${encodeURIComponent(cardId)}/access-history${query ? `?${query}` : ""}`,
      signal,
    }),
  );
}

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
  options?:
    | {
        search?: string;
        status?: string;
        limit?: number;
        cursor?: string | null;
      }
    | AbortSignal,
  signal?: AbortSignal,
): Promise<AdminCardsResponse> {
  let resolvedSignal = signal;
  let queryParams = "";

  if (options instanceof AbortSignal) {
    resolvedSignal = options;
  } else if (options && typeof options === "object") {
    const params = new URLSearchParams();
    if (options.search?.trim()) params.set("search", options.search.trim());
    if (options.status && options.status !== "all") params.set("status", options.status);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const qs = params.toString();
    if (qs) queryParams = `?${qs}`;
  }

  return adminCardsResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards${queryParams}`,
      signal: resolvedSignal,
    }),
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

export async function getAdminInventoryStats(
  signal?: AbortSignal,
): Promise<CardInventoryStats> {
  return cardInventoryStatsSchema.parse(
    await requestJson<unknown>({ path: "/admin/cards/stats", signal }),
  );
}

export async function batchProvisionCards(
  payload: { batch_id: string; chip_type: string; quantity: number },
  signal?: AbortSignal,
): Promise<BatchCardProvisionResponse> {
  return batchCardProvisionResponseSchema.parse(
    await requestJson<unknown>({
      path: "/admin/cards/batch",
      method: "POST",
      body: payload,
      signal,
    }),
  );
}

export async function updateAdminCardStatus(
  cardId: string,
  payload: { target_status: string; reason: string },
  signal?: AbortSignal,
): Promise<AdminCard> {
  return adminCardResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards/${encodeURIComponent(cardId)}/status`,
      method: "POST",
      body: payload,
      signal,
    }),
  );
}

export async function quickLinkAdminCard(
  cardId: string,
  payload: { user_id: string; reason: string },
  signal?: AbortSignal,
): Promise<AdminCard> {
  return adminCardResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards/${encodeURIComponent(cardId)}/quick-link`,
      method: "POST",
      body: payload,
      signal,
    }),
  );
}

export async function quickUnlinkAdminCard(
  cardId: string,
  payload: { reason: string },
  signal?: AbortSignal,
): Promise<AdminCard> {
  return adminCardResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards/${encodeURIComponent(cardId)}/quick-unlink`,
      method: "POST",
      body: payload,
      signal,
    }),
  );
}

export async function listAdminCustodyEvents(
  limit = 20,
  signal?: AbortSignal,
): Promise<CustodyEventListResponse> {
  return custodyEventListResponseSchema.parse(
    await requestJson<unknown>({
      path: `/admin/cards/audit-log?limit=${encodeURIComponent(limit)}`,
      signal,
    }),
  );
}
