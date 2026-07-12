import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "src/api/openapi.json");
const sourceUrl = process.env.EMERCARD_OPENAPI_URL;

if (!sourceUrl) {
  console.error(
    "EMERCARD_OPENAPI_URL is required to sync the OpenAPI snapshot.",
  );
  process.exit(1);
}

const response = await fetch(sourceUrl);
if (!response.ok) {
  console.error(
    `Failed to fetch OpenAPI snapshot from ${sourceUrl}: ${response.status}`,
  );
  process.exit(1);
}

const body = await response.text();
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, body, "utf8");
console.log(`Wrote OpenAPI snapshot to ${outputPath}`);
