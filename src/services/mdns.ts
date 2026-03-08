import Bonjour from "bonjour-service";

let instance: Bonjour | null = null;

export function advertiseMDNS(name: string, port: number, https = false): void {
	try {
		instance = new Bonjour();
		instance.publish({
			name,
			type: https ? "https" : "http",
			port,
			txt: { path: "/ui/", ark: "true" },
		});
		const protocol = https ? "https" : "http";
		const portStr =
			(https && port === 443) || (!https && port === 80) ? "" : `:${port}`;
		console.log(
			`📡 mDNS: ${protocol}://${name.toLowerCase().replace(/\s+/g, "-")}.local${portStr}`,
		);
	} catch (err) {
		// mDNS is best-effort — don't crash the server if it fails
		console.warn("⚠ mDNS advertisement failed (non-fatal):", String(err));
	}
}

export function stopMDNS(): void {
	try {
		instance?.unpublishAll();
		instance?.destroy();
	} catch {
		// ignore
	}
}
