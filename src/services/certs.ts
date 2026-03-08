import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import selfsigned from "selfsigned";

const CERT_DIR = resolve(import.meta.dirname, "../../storage/certs");

export interface ArkCerts {
	key: string;
	cert: string;
}

export async function getOrCreateCerts(
	hostname = "ark-node",
): Promise<ArkCerts> {
	const keyPath = resolve(CERT_DIR, "server.key");
	const certPath = resolve(CERT_DIR, "server.crt");

	if (existsSync(keyPath) && existsSync(certPath)) {
		const [key, cert] = await Promise.all([
			readFile(keyPath, "utf-8"),
			readFile(certPath, "utf-8"),
		]);
		console.log("🔐 Loaded existing TLS certificate");
		return { key, cert };
	}

	mkdirSync(CERT_DIR, { recursive: true });
	console.log("🔐 Generating self-signed TLS certificate...");

	const attrs = [{ name: "commonName", value: hostname }];
	const notAfterDate = new Date();
	notAfterDate.setFullYear(notAfterDate.getFullYear() + 10); // 10-year cert
	const pems = (await selfsigned.generate(attrs, {
		notAfterDate,
		algorithm: "sha256",
		extensions: [
			{
				name: "subjectAltName",
				altNames: [
					{ type: 2, value: `${hostname}.local` },
					{ type: 2, value: "localhost" },
					{ type: 7, ip: "127.0.0.1" },
					{ type: 7, ip: "::1" },
				],
			},
		],
	})) as { private: string; cert: string };

	await writeFile(keyPath, pems.private, { mode: 0o600 });
	await writeFile(certPath, pems.cert);

	console.log("🔐 TLS certificate saved to storage/certs/");
	console.log(
		`   Trust ${certPath} on your devices to remove browser warnings`,
	);

	return { key: pems.private, cert: pems.cert };
}
