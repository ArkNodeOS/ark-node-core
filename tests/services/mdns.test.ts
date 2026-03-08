import { describe, expect, it } from "bun:test";

describe("mDNS service", () => {
	it("advertiseMDNS does not throw (best-effort)", async () => {
		const { advertiseMDNS, stopMDNS } = await import(
			"../../src/services/mdns.ts"
		);
		// Should not throw even if mDNS is unavailable in test env
		expect(() => advertiseMDNS("Test Ark", 3000, false)).not.toThrow();
		expect(() => stopMDNS()).not.toThrow();
	});
});
