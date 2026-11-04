import assert from "node:assert/strict";
import {
	checkOpenCodeGoQuotaAccount,
	getOpenCodeGoWindowRemaining,
	OPENCODE_GO_USAGE_URL,
	parseOpenCodeGoUsageSnapshot,
} from "../extensions/lib/opencode-go.ts";

const account = (providerName, key) => ({
	providerName,
	baseProvider: "opencode-go",
	displayName: providerName,
	auth: key === undefined ? undefined : { type: "api_key", key },
});
const window = (percent, status = "ok") => ({ percent, status, resetsAt: "2026-12-01T12:00:00.000Z" });
const payload = () => ({ usage: { rolling: window(10), weekly: window(20), monthly: window(30) } });
const originalFetch = globalThis.fetch;

try {
	const calls = [];
	globalThis.fetch = async (url, options) => {
		calls.push({ url, options });
		return Response.json(payload());
	};
	const first = await checkOpenCodeGoQuotaAccount(account("opencode-go-2", "key-one"), {});
	const second = await checkOpenCodeGoQuotaAccount(account("opencode-go-3", "key-two"), {});
	assert.equal(first.kind, "ready");
	assert.equal(first.score, 70);
	assert.match(first.summary, /5h 90% \| 7d 80% \| month 70%/);
	assert.equal(first.details.filter((line) => line.includes("resets")).length, 3);
	assert.equal(calls[0].url, OPENCODE_GO_USAGE_URL);
	assert.equal(calls[0].options.headers.Authorization, "Bearer key-one");
	assert.equal(calls[1].options.headers.Authorization, "Bearer key-two");
	assert.ok(calls[0].options.headers["x-opencode-session"]);
	assert.equal(calls[0].options.headers["x-opencode-session"], calls[1].options.headers["x-opencode-session"]);
	assert.equal(second.account.providerName, "opencode-go-3");
	const fromEnvironment = await checkOpenCodeGoQuotaAccount(account("opencode-go"), {
		keys: { peek: async () => "environment-key" },
	});
	assert.equal(fromEnvironment.kind, "ready");
	assert.equal(calls[2].options.headers.Authorization, "Bearer environment-key");
	await checkOpenCodeGoQuotaAccount(account("opencode-go-2", "saved-key"), {
		keys: { peek: async () => "active-override-key" },
	});
	assert.equal(calls[3].options.headers.Authorization, "Bearer active-override-key");

	const missing = await checkOpenCodeGoQuotaAccount(account("opencode-go-4"), {});
	assert.equal(missing.kind, "missing-auth");
	assert.equal(calls.length, 4, "a missing key must not send a request");

	const reached = payload();
	reached.usage.monthly = window(100);
	globalThis.fetch = async () => Response.json(reached);
	const atLimit = await checkOpenCodeGoQuotaAccount(account("opencode-go-2", "key-one"), {});
	assert.equal(atLimit.score, 0);
	assert.equal(atLimit.kind, "low", "the endpoint cannot establish whether paid Extra Usage is enabled");
	assert.match(atLimit.summary, /included limit reached/);
	assert.ok(atLimit.details.some((line) => line.includes("charged to your balance")));

	const limited = payload();
	limited.usage.rolling = window(30, "rate-limited");
	const limitedSnapshot = parseOpenCodeGoUsageSnapshot(limited);
	assert.equal(getOpenCodeGoWindowRemaining(limitedSnapshot.rolling), 70);
	globalThis.fetch = async () => Response.json(limited);
	const rateLimited = await checkOpenCodeGoQuotaAccount(account("opencode-go-2", "key-one"), {});
	assert.equal(rateLimited.score, 0);
	assert.match(rateLimited.summary, /5h 70% \(limited\)/);

	for (const invalid of [
		{},
		{ usage: { ...payload().usage, monthly: undefined } },
		{ usage: { ...payload().usage, weekly: window(101) } },
		{ usage: { ...payload().usage, weekly: { ...window(10), resetsAt: "invalid" } } },
		{ usage: { ...payload().usage, rolling: window(10, "unknown") } },
	]) {
		assert.equal(parseOpenCodeGoUsageSnapshot(invalid), undefined);
		globalThis.fetch = async () => Response.json(invalid);
		assert.equal((await checkOpenCodeGoQuotaAccount(account("opencode-go-2", "key-one"), {})).kind, "error");
	}

	for (const status of [401, 403, 429, 500]) {
		globalThis.fetch = async () => new Response("key-one", { status });
		const result = await checkOpenCodeGoQuotaAccount(account("opencode-go-2", "key-one"), {});
		assert.equal(result.kind, "error");
		assert.match(result.summary, new RegExp(String(status)));
		assert.doesNotMatch(result.details.join(" "), /key-one/);
	}
	globalThis.fetch = async () => { throw new Error("key-one"); };
	const failed = await checkOpenCodeGoQuotaAccount(account("opencode-go-2", "key-one"), {});
	assert.equal(failed.kind, "error");
	assert.doesNotMatch(failed.details.join(" "), /key-one/);

	const controller = new AbortController();
	controller.abort();
	await assert.rejects(checkOpenCodeGoQuotaAccount(account("opencode-go-2", "key-one"), {}, controller.signal));
	console.log("OpenCode Go quota checks passed");
} finally {
	globalThis.fetch = originalFetch;
}
