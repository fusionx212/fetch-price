/**
 * POST /api/tle/pipeline — cron-triggered full kill chain (CRON_SECRET gate)
 */
import { json, requireCronAuth } from "./_shared/access-gate.mjs";
import { spawn } from "node:child_process";
import { join } from "node:path";

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });
  if (!requireCronAuth(req)) return json(401, { error: "Unauthorized" });

  const engineRoot = process.env.TLE_ENGINE_ROOT || "C:\\Users\\dalec\\repos\\trade-lifecycle-engine";
  const script = join(engineRoot, "pipeline", "run-full-kill-chain.mjs");

  const result = await new Promise((resolve) => {
    const p = spawn(process.execPath, [script], {
      cwd: engineRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out }));
  });

  if (result.code !== 0) return json(500, { error: "Pipeline failed", log: result.out.slice(-2000) });
  return json(200, { ok: true, log: result.out.slice(-500) });
};

export const config = { path: "/api/tle/pipeline" };
