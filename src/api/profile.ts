import { z } from "zod";
import { requestJson } from "./http-client";

const profileReadinessStatusSchema = z.enum(["not_started", "incomplete", "ready"]);
const genderSchema = z.enum(["female", "male", "other", "prefer_not_to_say"]);
const bloodTypeSchema = z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]);

const emergencyContactSchema = z.object({
  name: z.string(),
  relationship: z.string(),
  phone: z.string(),
});

const authenticatedProfileSchema = z.object({
  display_name: z.string().nullable(),
  birth_year: z.number().int().nullable(),
  gender: genderSchema.nullable(),
  blood_type: bloodTypeSchema.nullable(),
  critical_allergies: z.array(z.string()),
  important_conditions: z.array(z.string()),
  critical_medications: z.array(z.string()),
  emergency_note: z.string().nullable(),
  emergency_contacts: z.array(emergencyContactSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

const profileReadinessSchema = z.object({
  status: profileReadinessStatusSchema,
  missing_fields: z.array(z.string()),
  required_contact_count: z.number().int(),
  completed_required_field_count: z.number().int(),
  total_required_field_count: z.number().int(),
});

const profileViewSchema = z.object({
  profile: authenticatedProfileSchema.nullable(),
  readiness: profileReadinessSchema,
});

const publicPreviewLinkSchema = z.object({
  public_url: z.string().min(1),
});

const publicPreviewLinkOperationSchema = z.object({
  action: z.string(),
  status: z.string(),
  public_url: z.string().nullable().optional(),
});

const profileUpsertInputSchema = z.object({
  display_name: z.string().nullable().optional(),
  birth_year: z.number().int().nullable().optional(),
  gender: genderSchema.nullable().optional(),
  blood_type: bloodTypeSchema.nullable().optional(),
  critical_allergies: z.array(z.string()).default([]),
  important_conditions: z.array(z.string()).default([]),
  critical_medications: z.array(z.string()).default([]),
  emergency_note: z.string().nullable().optional(),
  emergency_contacts: z
    .array(
      z.object({
        name: z.string(),
        relationship: z.string(),
        phone: z.string(),
      }),
    )
    .default([]),
});

export type ProfileReadinessStatus = z.infer<typeof profileReadinessStatusSchema>;
export type ProfileView = z.infer<typeof profileViewSchema>;
export type ProfileUpsertInput = z.infer<typeof profileUpsertInputSchema>;
export type PublicPreviewLink = z.infer<typeof publicPreviewLinkSchema>;
export type PublicPreviewLinkOperation = z.infer<typeof publicPreviewLinkOperationSchema>;

export const profileKeys = {
  current: ["profile", "current"] as const,
  previewLink: ["profile", "preview-link"] as const,
};

export function profileReadinessLabel(status: ProfileReadinessStatus) {
  switch (status) {
    case "not_started":
      return "Chưa bắt đầu";
    case "ready":
      return "Sẵn sàng";
    case "incomplete":
    default:
      return "Chưa hoàn thiện";
  }
}

export function profileMissingFieldLabel(field: string) {
  switch (field) {
    case "display_name":
      return "Tên hiển thị";
    case "birth_year":
      return "Năm sinh";
    case "gender":
      return "Giới tính";
    case "blood_type":
      return "Nhóm máu";
    case "emergency_contacts":
      return "Người liên hệ khẩn cấp";
    default:
      return field;
  }
}

export async function getCurrentProfile(signal?: AbortSignal): Promise<ProfileView> {
  const response = await requestJson<unknown>({
    path: "/me/profile",
    signal,
  });
  return profileViewSchema.parse(response);
}

export async function saveCurrentProfile(payload: ProfileUpsertInput, signal?: AbortSignal): Promise<ProfileView> {
  const response = await requestJson<unknown>({
    path: "/me/profile",
    method: "PUT",
    body: profileUpsertInputSchema.parse(payload),
    signal,
  });
  return profileViewSchema.parse(response);
}

export async function createPublicPreviewLink(signal?: AbortSignal): Promise<PublicPreviewLink> {
  const response = await requestJson<unknown>({
    path: "/me/profile/public-preview-link",
    method: "POST",
    signal,
  });
  return publicPreviewLinkSchema.parse(response);
}

export async function generatePublicPreviewLink(signal?: AbortSignal): Promise<PublicPreviewLinkOperation> {
  const response = await requestJson<unknown>({
    path: "/me/profile/public-preview-link/generate",
    method: "POST",
    signal,
  });
  return publicPreviewLinkOperationSchema.parse(response);
}

export async function regeneratePublicPreviewLink(signal?: AbortSignal): Promise<PublicPreviewLinkOperation> {
  const response = await requestJson<unknown>({
    path: "/me/profile/public-preview-link/regenerate",
    method: "POST",
    signal,
  });
  return publicPreviewLinkOperationSchema.parse(response);
}

export async function disablePublicPreviewLink(signal?: AbortSignal): Promise<PublicPreviewLinkOperation> {
  const response = await requestJson<unknown>({
    path: "/me/profile/public-preview-link/disable",
    method: "POST",
    signal,
  });
  return publicPreviewLinkOperationSchema.parse(response);
}
