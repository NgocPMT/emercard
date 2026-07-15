import { z } from "zod";

export const sessionRoleSchema = z.enum(["user", "admin"]);
const genderSchema = z.enum(["female", "male", "other", "prefer_not_to_say"]);
const bloodTypeSchema = z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]);

export const currentSessionSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email(),
    role: sessionRoleSchema,
    created_at: z.string().min(1).optional(),
    updated_at: z.string().min(1).optional(),
  })
  .passthrough();

export type CurrentSession = z.infer<typeof currentSessionSchema>;

export const publicEmergencyContactSchema = z
  .object({
    name: z.string(),
    relationship: z.string(),
    phone: z.string(),
  })
  .strict();

export const publicEmergencyProfileSchema = z
  .object({
    display_name: z.string().nullable(),
    birth_year: z.number().int().nullable(),
    gender: genderSchema.nullable(),
    blood_type: bloodTypeSchema.nullable(),
    critical_allergies: z.array(z.string()),
    important_conditions: z.array(z.string()),
    critical_medications: z.array(z.string()),
    emergency_note: z.string().nullable(),
    emergency_contacts: z.array(publicEmergencyContactSchema),
    profile_updated_at: z.string(),
  })
  .strict();

export const publicEmergencyResponseSchema = z.object({ profile: publicEmergencyProfileSchema }).strict();

export type PublicEmergencyContact = z.infer<typeof publicEmergencyContactSchema>;
export type PublicEmergencyProfile = z.infer<typeof publicEmergencyProfileSchema>;

export const validationDetailSchema = z
  .object({
    location: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
    type: z.string(),
  })
  .passthrough();

export type ValidationDetail = z.infer<typeof validationDetailSchema>;

export const errorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        request_id: z.string().optional(),
        details: z.array(validationDetailSchema).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
