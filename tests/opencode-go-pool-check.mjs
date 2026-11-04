import assert from "node:assert/strict";
import { registerHooks } from "node:module";

globalThis.__goPoolTest = { subscriptions: [], allowed: undefined, selected: undefined, selectOptions: undefined };
const mocks = {
	"@oh-my-pi/pi-coding-agent": `export class BorderedLoader {}`,
	"./providers.ts": `
		export const PROVIDER_TEMPLATES = { "opencode-go": { displayName: "OpenCode Go" } };
		export const getBaseProvider = (name) => name.startsWith("opencode-go") ? "opencode-go" : undefined;
		export const subDisplayName = (entry) => "OpenCode Go #" + entry.index;`,
	"./core.ts": `
		export const adaptAuthStorage = (storage) => storage;
		export const getAuthStorage = (ctx) => ctx.modelRegistry.authStorage;
		export const getModels = () => [];
		export const subProviderName = (entry) => entry.provider + "-" + entry.index;`,
	"./config.ts": `
		export const loadGlobalConfig = () => ({ subscriptions: globalThis.__goPoolTest.subscriptions, presets: [] });
		export const loadProjectConfig = () => globalThis.__goPoolTest.allowed ? { allowedSubs: globalThis.__goPoolTest.allowed } : undefined;
		export const parseEnvConfig = () => [];
		export const mergeConfigs = (config) => config.subscriptions;
		export const normalizeEntries = (entries) => entries;`,
	"./ui.ts": `
		export const getWrappedSelectIndex = () => 0;
		export const showWrappedSelect = async (_ctx, options) => { globalThis.__goPoolTest.selectOptions = options; return globalThis.__goPoolTest.selected; };`,
};
registerHooks({
	resolve(specifier, context, nextResolve) {
		const isQuotaImport = context.parentURL?.endsWith("/quota.ts");
		if (mocks[specifier] && (specifier.startsWith("@") || isQuotaImport)) {
			return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
		}
		return nextResolve(specifier, context);
	},
});

const quota = await import("../extensions/lib/quota.ts");
const keys = ["pool-key-one", "pool-key-two"];
const storage = {
	hasAuth: (provider) => provider === "opencode-go",
	get: () => ({ type: "api_key", key: keys[0] }),
	keys: { peek: async () => keys[0], source: () => ({ kind: "api_key" }) },
	credentials: { list: () => [
		{ credential: { type: "api_key", key: keys[0] } },
		{ credential: { type: "api_key", key: "disabled-key" }, disabledCause: "disabled" },
		{ credential: { type: "api_key", key: keys[1] } },
	] },
};
const ctx = { cwd: "/test", model: { provider: "opencode-go", id: "beam-free", name: "Beam Free" }, modelRegistry: { authStorage: storage } };
const calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
	const authorization = options.headers.Authorization;
	calls.push(authorization);
	const weekly = authorization === "Bearer pool-key-one" ? 100 : 0;
	const window = (percent, status = "ok") => ({ percent, status, resetsAt: "2026-12-01T12:00:00Z" });
	return Response.json({ usage: { rolling: window(1), weekly: window(weekly, weekly === 100 ? "rate-limited" : "ok"), monthly: window(5) } });
};

try {
	const accounts = quota.collectQuotaAccounts(ctx, storage);
	assert.equal(accounts.length, 2);
	assert.deepEqual(accounts.map((account) => account.displayName), ["OpenCode Go (key 1)", "OpenCode Go (key 2)"]);
	assert.equal(new Set(accounts.map((account) => account.selectionId)).size, 2);
	const results = await quota.runQuotaChecks(accounts, storage);
	assert.deepEqual(calls.sort(), ["Bearer pool-key-one", "Bearer pool-key-two"]);
	assert.equal(results[0].account.displayName, "OpenCode Go (key 2)");
	assert.equal(results[0].kind, "ready");
	assert.equal(results[1].account.displayName, "OpenCode Go (key 1)");
	assert.equal(results[1].score, 0);
	assert.match(quota.formatQuotaCurrentHint(results, "opencode-go"), /2 saved keys; OMP selects the active key/);
	const items = quota.buildQuotaSelectItems(results, "opencode-go");
	assert.equal(new Set(items.map((item) => item.value)).size, 2);
	assert.equal(items.filter((item) => item.description.includes("best now")).length, 1);
	assert.ok(items.every((item) => !item.description.includes("current")));
	globalThis.__goPoolTest.selected = results[1].account.selectionId;
	const selected = await quota.selectQuotaResult(ctx, results, results[1].account.selectionId);
	assert.equal(selected.account.displayName, "OpenCode Go (key 1)");
	assert.equal(globalThis.__goPoolTest.selectOptions.initialValue, results[1].account.selectionId);
	const status = await quota.fetchStatusQuotaResult(ctx, "opencode-go", "opencode-go");
	assert.equal(status.opencodeGoPoolSize, 2);
	assert.match(quota.formatCurrentModelQuota(status, ctx.model), /^best of 2 /);

	calls.length = 0;
	globalThis.fetch = async (_url, options) => {
		const authorization = options.headers.Authorization;
		calls.push(authorization);
		if (authorization === "Bearer pool-key-one") return new Response("Unauthorized", { status: 401 });
		const window = { percent: 5, status: "ok", resetsAt: "2026-12-01T12:00:00Z" };
		return Response.json({ usage: { rolling: window, weekly: window, monthly: window } });
	};
	const withRejectedKey = await quota.runQuotaChecks(accounts, storage);
	assert.deepEqual(calls.sort(), ["Bearer pool-key-one", "Bearer pool-key-two"]);
	assert.equal(withRejectedKey.find((result) => result.account.displayName.endsWith("key 1)")).kind, "error");
	assert.equal(withRejectedKey.find((result) => result.account.displayName.endsWith("key 2)")).kind, "ready");

	storage.keys.source = () => ({ kind: "runtime" });
	const overridden = quota.collectQuotaAccounts(ctx, storage);
	assert.equal(overridden.length, 1, "runtime overrides must not be replaced by saved keys");
	assert.equal(overridden[0].useSavedApiKey, undefined);
	globalThis.__goPoolTest.allowed = ["different-provider"];
	assert.equal(quota.collectQuotaAccounts(ctx, storage).length, 0, "project restrictions still apply to the provider pool");
	console.log("OpenCode Go pool checks passed");
} finally {
	globalThis.fetch = originalFetch;
	delete globalThis.__goPoolTest;
}
