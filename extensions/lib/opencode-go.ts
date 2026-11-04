import { randomUUID } from "node:crypto";
import type { AuthStorage, QuotaAccount, QuotaCheckResult, QuotaStatusKind } from "./core.ts";

// The account usage endpoint is separate from the inference endpoint.
export const OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
const usageSessionId = randomUUID();

export interface OpenCodeGoUsageWindow {
	usedPercent: number;
	status: "ok" | "rate-limited";
	resetAt: number;
}

export interface OpenCodeGoUsageSnapshot {
	rolling: OpenCodeGoUsageWindow;
	weekly: OpenCodeGoUsageWindow;
	monthly: OpenCodeGoUsageWindow;
}

function parseWindow(value: unknown): OpenCodeGoUsageWindow | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const raw = value as Record<string, unknown>;
	if (typeof raw.percent !== "number" || !Number.isFinite(raw.percent) || raw.percent < 0 || raw.percent > 100) return undefined;
	if (raw.status !== "ok" && raw.status !== "rate-limited") return undefined;
	const resetMs = typeof raw.resetsAt === "string" ? Date.parse(raw.resetsAt) : NaN;
	if (!Number.isFinite(resetMs)) return undefined;
	return { usedPercent: raw.percent, status: raw.status, resetAt: Math.floor(resetMs / 1000) };
}

export function parseOpenCodeGoUsageSnapshot(value: unknown): OpenCodeGoUsageSnapshot | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	const usage = (value as Record<string, unknown>).usage;
	if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
	const raw = usage as Record<string, unknown>;
	const rolling = parseWindow(raw.rolling);
	const weekly = parseWindow(raw.weekly);
	const monthly = parseWindow(raw.monthly);
	return rolling && weekly && monthly ? { rolling, weekly, monthly } : undefined;
}

export function getOpenCodeGoWindowRemaining(window: OpenCodeGoUsageWindow): number {
	return 100 - window.usedPercent;
}

export function isOpenCodeGoWindowLimited(window: OpenCodeGoUsageWindow): boolean {
	return window.status === "rate-limited" || window.usedPercent >= 100;
}

function classifySnapshot(snapshot: OpenCodeGoUsageSnapshot): { kind: QuotaStatusKind; score: number } {
	const score = Math.min(...Object.values(snapshot).map((window) =>
		isOpenCodeGoWindowLimited(window) ? 0 : getOpenCodeGoWindowRemaining(window),
	));
	// A full included-usage window can still serve paid requests when Extra Usage
	// is enabled. The usage endpoint does not expose that setting.
	if (score <= 15) return { kind: "low", score };
	if (score <= 30) return { kind: "watch", score };
	return { kind: "ready", score };
}

function resetLabel(window: OpenCodeGoUsageWindow): string {
	return new Date(window.resetAt * 1000).toLocaleString();
}

function windowDetails(label: string, window: OpenCodeGoUsageWindow): string {
	const remaining = getOpenCodeGoWindowRemaining(window);
	return `${label}: ${remaining}% included allowance left${isOpenCodeGoWindowLimited(window) ? " (limit reached)" : ""}, resets ${resetLabel(window)}`;
}

function windowSummary(label: string, window: OpenCodeGoUsageWindow): string {
	return `${label} ${getOpenCodeGoWindowRemaining(window)}%${isOpenCodeGoWindowLimited(window) ? " (limited)" : ""}`;
}

function errorResult(account: QuotaAccount, summary: string, hint?: string): QuotaCheckResult {
	return {
		account,
		kind: "error",
		summary,
		details: [
			`account: ${account.displayName}`,
			`provider: ${account.providerName}`,
			`details: ${summary}`,
			...(hint ? [`hint: ${hint}`] : []),
		],
		score: 0,
	};
}

export async function checkOpenCodeGoQuotaAccount(
	account: QuotaAccount,
	authStorage: AuthStorage,
	signal?: AbortSignal,
): Promise<QuotaCheckResult> {
	let key = account.auth?.type === "api_key" ? account.auth.key : undefined;
	const keys = authStorage.keys as { peek?: (providerName: string) => Promise<string | undefined> } | undefined;
	if (typeof keys?.peek === "function") {
		try {
			key = await keys.peek(account.providerName) ?? key;
		} catch (error: unknown) {
			if (signal?.aborted) throw error;
			return errorResult(account, "Could not resolve the OpenCode Go API key", "Check the account's OMP authentication settings.");
		}
	}
	if (typeof key !== "string" || !key.trim()) {
		return {
			account,
			kind: "missing-auth",
			summary: "no API key available for quota checks",
			details: [
				`account: ${account.displayName}`,
				`provider: ${account.providerName}`,
				"login: use /multi-auth login or /login to save this account's OpenCode Go key",
			],
			score: 0,
		};
	}

	try {
		const timeout = AbortSignal.timeout(15_000);
		const response = await fetch(OPENCODE_GO_USAGE_URL, {
			headers: {
				Authorization: `Bearer ${key}`,
				Accept: "application/json",
				"User-Agent": "omp-multi-auth/1.3",
				"x-opencode-session": usageSessionId,
			},
			signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
		});
		if (!response.ok) {
			const hint = response.status === 401 ? "Check the saved API key and log in again."
				: response.status === 403 ? "Check that this key can access an active Go subscription."
				: "Retry the usage check later; this does not establish whether inference is blocked.";
			return errorResult(account, `OpenCode Go usage check failed (HTTP ${response.status})`, hint);
		}
		const snapshot = parseOpenCodeGoUsageSnapshot(await response.json());
		if (!snapshot) return errorResult(account, "OpenCode Go returned incomplete or invalid usage data", "Retry or check the OpenCode Console.");

		const classification = classifySnapshot(snapshot);
		return {
			account,
			...classification,
			summary: `${windowSummary("5h", snapshot.rolling)} | ${windowSummary("7d", snapshot.weekly)} | ${windowSummary("month", snapshot.monthly)} | ${classification.score === 0 ? "included limit reached" : `${classification.kind} (included usage)`}`,
			details: [
				`account: ${account.displayName}`,
				`provider: ${account.providerName}`,
				windowDetails("5-hour window", snapshot.rolling),
				windowDetails("weekly window", snapshot.weekly),
				windowDetails("monthly window", snapshot.monthly),
				"Extra Usage may allow requests charged to your balance; its setting is not reported by this endpoint.",
				`endpoint: ${OPENCODE_GO_USAGE_URL}`,
			],
			opencodeGoSnapshot: snapshot,
		};
	} catch (error: unknown) {
		if (signal?.aborted) throw error;
		return errorResult(account, "OpenCode Go usage check could not be completed", "Check your connection or retry later.");
	}
}
