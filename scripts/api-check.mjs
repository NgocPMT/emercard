import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = resolve(root, "src/api/openapi.json");
const generatedPath = resolve(root, "src/api/generated");
const tempDir = await mkdtemp(join(tmpdir(), "emercard-openapi-"));
const tempOut = join(tempDir, "generated");

const generate = spawnSync(
  "npm",
  ["exec", "--", "openapi-ts", "-i", snapshotPath, "-o", tempOut],
  {
    cwd: root,
    stdio: "inherit",
  },
);

if (generate.status !== 0) {
  process.exit(generate.status ?? 1);
}

const compare = spawnSync("diff", ["-qr", generatedPath, tempOut], {
  cwd: root,
  encoding: "utf8",
});

if (compare.status !== 0) {
  console.error("Generated OpenAPI client is stale. Run npm run api:generate.");
  if (compare.stdout) console.error(compare.stdout.trimEnd());
  if (compare.stderr) console.error(compare.stderr.trimEnd());
  await rm(tempDir, { recursive: true, force: true });
  process.exit(1);
}

await rm(tempDir, { recursive: true, force: true });
console.log("OpenAPI generated output is up to date.");
