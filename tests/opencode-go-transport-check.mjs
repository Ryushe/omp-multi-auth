import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const models = [
	{ id: "chat-model", name: "Chat", api: "openai-completions", baseUrl: "https://example.test/chat", provider: "opencode-go", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1000, maxTokens: 100 },
	{ id: "other-model", name: "Other", api: "anthropic-messages", baseUrl: "https://example.test/other", provider: "opencode-go", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1000, maxTokens: 100 },
];
globalThis.__multiAuthTest = { models, calls: [] };
const mocks = {
	"@oh-my-pi/pi-catalog": `export const getBundledModels = () => globalThis.__multiAuthTest.models;`,
	"@oh-my-pi/pi-ai/registry": `export const getProviderDefinition = () => undefined;`,
	"@oh-my-pi/pi-ai": `
		export class AssistantMessageEventStream {
			constructor() { this.events = []; }
			forwardLocalWorkFrom() {}
			push(event) { this.events.push(event); }
			fail(error) { this.error = error; }
		}
		export function streamSimple(model, context, options) {
			globalThis.__multiAuthTest.calls.push({ model, context, options });
			return { async *[Symbol.asyncIterator]() { yield { type: "done", message: { provider: model.provider } }; } };
		}`,
};
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
		return nextResolve(specifier, context);
	},
});

const { registerSub } = await import("../extensions/lib/providers.ts");
const { adaptAuthStorage } = await import("../extensions/lib/core.ts");
class PrivateKeyStorage {
	#keys = { peek: async () => "private-getter-key" };
	get keys() { return this.#keys; }
}
assert.equal(await adaptAuthStorage(new PrivateKeyStorage()).keys.peek("opencode-go"), "private-getter-key");
let registered;
registerSub({ registerProvider: (name, config) => { registered = { name, config }; } }, { provider: "opencode-go", index: 2 });
assert.equal(registered.name, "opencode-go-2");
assert.equal(registered.config.models.length, 2);
assert.ok(registered.config.models.every((model) => model.api === "opencode-go-multi-auth"));
assert.equal(await registered.config.oauth.login({ onPrompt: async () => "  example-key  " }), "example-key");

for (const original of models) {
	const emitted = registered.config.streamSimple(
		{ ...registered.config.models.find((model) => model.id === original.id), provider: registered.name },
		{ messages: [] },
		{ apiKey: "example-key" },
	);
	await new Promise((resolve) => setImmediate(resolve));
	const call = globalThis.__multiAuthTest.calls.at(-1);
	assert.equal(call.model.provider, "opencode-go");
	assert.equal(call.model.api, original.api);
	assert.equal(call.model.baseUrl, original.baseUrl);
	assert.equal(call.options.apiKey, "example-key");
	assert.equal(emitted.events[0].message.provider, "opencode-go-2");
}
delete globalThis.__multiAuthTest;
console.log("OpenCode Go transport checks passed");
