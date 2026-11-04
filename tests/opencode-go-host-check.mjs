import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const agentDir = mkdtempSync(join(tmpdir(), "omp-multi-auth-go-"));
let child;
let closed;
try {
	const common = ["--mode", "rpc", "--no-extensions", "--no-skills", "--no-rules", "--no-lsp", "--no-session"];
	const env = { ...process.env, PI_CODING_AGENT_DIR: agentDir, MULTI_SUB: "opencode-go:2" };
	const bootstrap = spawnSync("omp", common, { cwd: root, env, encoding: "utf8", timeout: 30_000 });
	assert.equal(bootstrap.status, 0, bootstrap.stderr);
	const db = new DatabaseSync(join(agentDir, "agent.db"));
	const insert = db.prepare("INSERT INTO auth_credentials (provider, credential_type, data, identity_key) VALUES (?, 'api_key', ?, NULL)");
	insert.run("opencode-go-2", JSON.stringify({ key: "test-go-key-two" }));
	insert.run("opencode-go-3", JSON.stringify({ key: "test-go-key-three" }));
	db.close();
	writeFileSync(join(agentDir, "config.yml"), `retry:\n  enabled: true\n  maxRetries: 1\n  baseDelayMs: 1\n  maxDelayMs: 1000\n  modelFallback: true\n  fallbackChains:\n    default:\n      - opencode-go-3/beam-free\n`);

	const quotaCapture = join(agentDir, "quota.json");
	const wireCapture = join(agentDir, "wire.json");
	const probe = join(agentDir, "probe.ts");
	const quotaUrl = pathToFileURL(join(root, "extensions", "lib", "opencode-go.ts")).href;
	writeFileSync(probe, `
import { writeFileSync } from "node:fs";
import { checkOpenCodeGoQuotaAccount } from ${JSON.stringify(quotaUrl)};
const calls = [];
const requests = [];
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (url === "https://opencode.ai/zen/go/v1/usage") {
    const auth = headers.get("authorization");
    calls.push({ auth, session: headers.get("x-opencode-session") });
    const percent = auth === "Bearer test-go-key-two" ? 20 : 70;
    const window = { status: "ok", percent, resetsAt: "2026-12-01T12:00:00Z" };
    return Response.json({ usage: { rolling: window, weekly: window, monthly: window } });
  }
  if (url.startsWith("https://opencode.ai/inference/go/")) {
    const auth = headers.get("authorization");
    requests.push({ url, auth, session: headers.get("x-opencode-session"), userAgent: headers.get("user-agent") });
    if (auth === "Bearer test-go-key-two") {
      return Response.json({ error: { message: "Usage limit reached", type: "rate_limit_error", code: "rate_limit_exceeded" } }, { status: 429, headers: { "retry-after": "0" } });
    }
    writeFileSync(process.env.MP_GO_WIRE, JSON.stringify(requests));
    setTimeout(() => process.exit(0), 500);
    return new Response("data: [DONE]\\n\\n", { headers: { "content-type": "text/event-stream" } });
  }
  throw new Error("Unexpected network request in isolated host test");
};
export default function probe(pi) {
  pi.on("session_start", async (_event, ctx) => {
    const storage = ctx.modelRegistry.authStorage;
    const accounts = ["opencode-go-2", "opencode-go-3"].map((providerName) => ({
      providerName, baseProvider: "opencode-go", displayName: providerName,
      auth: typeof storage.get === "function" ? storage.get(providerName) : storage.credentials.get(providerName),
    }));
    const results = await Promise.all(accounts.map((account) => checkOpenCodeGoQuotaAccount(account, storage)));
    writeFileSync(process.env.MP_GO_QUOTA, JSON.stringify({ calls, results: results.map((result) => ({ provider: result.account.providerName, kind: result.kind, score: result.score })) }));
  });
}
`);
	child = spawn("omp", [...common, "--extension", join(root, "extensions", "multi-auth.ts"), "--extension", probe], {
		cwd: root,
		env: { ...env, MP_GO_QUOTA: quotaCapture, MP_GO_WIRE: wireCapture },
		timeout: 45_000,
	});
	closed = new Promise((resolve) => child.once("close", resolve));
	const stderr = [];
	child.stderr.on("data", (chunk) => stderr.push(chunk));
	const waiters = [];
	const statusEvents = [];
	let resolveQuotaStatus;
	const quotaStatus = new Promise((resolve) => { resolveQuotaStatus = resolve; });
	const lines = createInterface({ input: child.stdout });
	lines.on("line", (line) => {
		try {
			const event = JSON.parse(line);
			if (event.method === "setStatus") statusEvents.push({ key: event.statusKey, text: event.statusText });
			if (event.method === "setStatus" && event.statusKey === "multi-auth-quota" && /5h 80%/.test(event.statusText ?? "")) resolveQuotaStatus();
			for (let i = waiters.length - 1; i >= 0; i--) {
				if (waiters[i].id === event.id) waiters.splice(i, 1)[0].resolve(event);
			}
		} catch { /* Ignore non-JSON output. */ }
	});
	const send = (request) => new Promise((resolve) => {
		waiters.push({ id: request.id, resolve });
		child.stdin.write(`${JSON.stringify(request)}\n`);
	});
	const models = await send({ id: "models", type: "get_available_models" });
	assert.equal(models.success, true);
	const model = models.data.models.find((candidate) => candidate.provider === "opencode-go-2" && candidate.id === "beam-free");
	assert.ok(model, "OpenCode Go clone is missing the fallback test model");
	const selected = await send({ id: "select", type: "set_model", provider: model.provider, modelId: model.id });
	assert.equal(selected.success, true, JSON.stringify(selected));
	await send({ id: "prompt", type: "prompt", message: "Say hello." });
	let statusTimer;
	try {
		await Promise.race([
			quotaStatus,
			new Promise((_, reject) => { statusTimer = setTimeout(() => reject(new Error(`Go quota status was not refreshed: ${JSON.stringify(statusEvents)}; quota probe: ${existsSync(quotaCapture) ? readFileSync(quotaCapture, "utf8") : "pending"}; ${Buffer.concat(stderr).toString()}`)), 5_000); }),
		]);
	} finally {
		clearTimeout(statusTimer);
	}
	const exitCode = await closed;
	assert.equal(exitCode, 0, Buffer.concat(stderr).toString());
	assert.ok(existsSync(quotaCapture), "quota probe did not run");
	assert.ok(existsSync(wireCapture), "Go inference did not reach the mocked transport");
	const quota = JSON.parse(readFileSync(quotaCapture, "utf8"));
	assert.deepEqual(quota.calls.map((call) => call.auth).sort(), ["Bearer test-go-key-three", "Bearer test-go-key-two"]);
	assert.ok(quota.calls.every((call) => call.session));
	assert.deepEqual(quota.results, [
		{ provider: "opencode-go-2", kind: "ready", score: 80 },
		{ provider: "opencode-go-3", kind: "watch", score: 30 },
	]);
	const wire = JSON.parse(readFileSync(wireCapture, "utf8"));
	assert.ok(wire.some((request) => request.auth === "Bearer test-go-key-two"));
	assert.equal(wire.at(-1).auth, "Bearer test-go-key-three", "configured fallback did not use the second account");
	assert.ok(wire.every((request) => /^https:\/\/opencode\.ai\/inference\/go\//.test(request.url)));
	assert.ok(wire.every((request) => request.session), "OpenCode session attribution is missing");
	assert.ok(wire.every((request) => request.userAgent), "client user agent is missing");
	console.log("OpenCode Go host quota, transport, and fallback checks passed");
} finally {
	if (child && child.exitCode === null) child.kill("SIGTERM");
	if (closed) await closed;
	rmSync(agentDir, { recursive: true, force: true });
}
