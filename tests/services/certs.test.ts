import { describe, expect, it } from "bun:test";

describe("cert generation", () => {
	it("generates key and cert pem strings", async () => {
		const selfsigned = (await import("selfsigned")).default;
		const attrs = [{ name: "commonName", value: "test-ark" }];
		const pems = (await selfsigned.generate(attrs, {
			days: 1,
			algorithm: "sha256",
		})) as {
			private: string;
			cert: string;
		};
		expect(pems.private).toContain("PRIVATE KEY");
		expect(pems.cert).toContain("CERTIFICATE");
	});

	it("getOrCreateCerts returns key and cert", async () => {
		const { getOrCreateCerts } = await import("../../src/services/certs.ts");
		// It will use the real storage/certs path - just verify shape
		const certs = await getOrCreateCerts("test-node");
		expect(typeof certs.key).toBe("string");
		expect(typeof certs.cert).toBe("string");
		expect(certs.key).toContain("PRIVATE KEY");
		expect(certs.cert).toContain("CERTIFICATE");
	});
});
