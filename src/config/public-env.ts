import { z } from "zod";

const publicEnvSchema = z
  .object({
    PUBLIC_APP_ENV: z
      .enum(["local", "test", "demo", "production"])
      .default("local"),
    PUBLIC_APP_NAME: z.string().min(1).default("EmerCard"),
    PUBLIC_SITE_URL: z
      .string()
      .url("PUBLIC_SITE_URL must be a valid URL")
      .default("http://localhost:4321"),
    PUBLIC_API_BASE_PATH: z.string().min(1).default("/api"),
    PUBLIC_DEMO_DATA_NOTICE: z.string().optional(),
  })
  .passthrough();

export const publicEnv = publicEnvSchema.parse(import.meta.env);
export type PublicEnv = typeof publicEnv;
