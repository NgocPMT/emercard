import { z } from "zod";

export const sessionRoleSchema = z.enum(["user", "admin"]);

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

export const emergencyContactSchema = z
  .object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().min(1),
  })
  .passthrough();

export const publicEmergencyProfileSchema = z
  .object({
    display_name: z.string().min(1),
    blood_type: z.string().nullable().optional(),
    critical_allergies: z.string().nullable().optional(),
    important_conditions: z.string().nullable().optional(),
    critical_medications: z.string().nullable().optional(),
    emergency_note: z.string().nullable().optional(),
    emergency_contacts: z.array(emergencyContactSchema).optional(),
  })
  .passthrough();

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
