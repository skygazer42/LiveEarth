import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const localEnvironmentFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(localEnvironmentFile)) process.loadEnvFile(localEnvironmentFile);

const configSchema = z.object({
  REDIS_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().min(20),
  OPENAI_VISION_MODEL: z.string().default("gpt-5.6-luna"),
  OPEN_METEO_API_KEY: z.string().min(1),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_STREAM_TOKEN: z.string().min(1),
  LIVE_EARTH_SAMPLE_INTERVAL_SECONDS: z.coerce.number().int().min(10).default(30),
  LIVE_EARTH_RANKING_INTERVAL_SECONDS: z.coerce.number().int().min(60).default(300),
});

export type WorkerConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return configSchema.parse(environment);
}
