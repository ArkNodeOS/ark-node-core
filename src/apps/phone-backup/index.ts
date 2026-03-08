/**
 * Phone Backup Module — backup your phone's camera roll to Ark over WiFi.
 * Uses WebDAV (built-in to most phones) + rclone for smart sync.
 *
 * Setup flow:
 * 1. POST /phone-backup/pair → generates a pairing code + QR
 * 2. On phone: use any WebDAV client (iOS Files app, FolderSync on Android)
 *    or configure rclone with the Ark's IP
 * 3. Phone connects to http://<ark-ip>:3000/phone-backup/dav/<token>/
 * 4. Files are written directly to storage/phone-backup/devices/<token>/
 *
 * Also supports rclone push from the phone side.
 */
import "reflect-metadata";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { z } from "zod";
import { Module, OnInit, Route } from "../../decorators/index.ts";
import type { ArkAPI } from "../../types/module.ts";

const STORAGE_DIR = resolve(import.meta.dirname, "../../../storage/phone-backup");

const PairSchema = z.object({
	deviceName: z.string().min(1).max(64),
	pin: z.string().length(6).regex(/^\d{6}$/).optional(),
});

const RcloneUploadSchema = z.object({
	token: z.string().min(32),
	filename: z.string().min(1),
});

interface PairedDevice {
	token: string;
	deviceName: string;
	pin: string;
	pairedAt: string;
	lastSync: string | null;
	fileCount: number;
	totalSizeBytes: number;
	enabled: boolean;
}

const DEVICES_FILE = "devices.json";

@Module({
	name: "phone-backup",
	version: "1.0.0",
	description: "Back up your phone's camera roll to Ark over WiFi — WebDAV + rclone",
	icon: "📱",
	permissions: ["storage", "network"],
})
export default class PhoneBackupModule {
	declare _api: ArkAPI;
	private devices: Map<string, PairedDevice> = new Map();

	@OnInit()
	async setup() {
		this._api.log("Phone backup module initialised");
		await this._api.storage.mkdir("devices");
		await this._api.storage.mkdir("incoming");
		await this.loadDevices();
	}

	private async loadDevices() {
		try {
			const buf = await this._api.storage.get(DEVICES_FILE);
			const arr = JSON.parse(buf.toString()) as PairedDevice[];
			for (const d of arr) this.devices.set(d.token, d);
			this._api.log(`Loaded ${this.devices.size} paired device(s)`);
		} catch {
			this.devices = new Map();
		}
	}

	private async saveDevices() {
		await this._api.storage.save(
			DEVICES_FILE,
			JSON.stringify([...this.devices.values()], null, 2),
		);
	}

	private generateToken(): string {
		return randomBytes(24).toString("hex");
	}

	private generatePairingCode(): string {
		return Math.floor(100000 + Math.random() * 900000).toString();
	}

	private generateQRText(token: string, host: string): string {
		// Returns text that encodes WebDAV URL — phone WebDAV clients can scan this
		return `webdav://${host}:3000/phone-backup/dav/${token}/`;
	}

	// ---- GET /phone-backup/devices — list paired devices ----
	@Route("GET", "/devices")
	async listDevices() {
		return {
			devices: [...this.devices.values()].map((d) => ({
				token: d.token.slice(0, 8) + "...", // partial token for display
				fullToken: d.token,
				deviceName: d.deviceName,
				pairedAt: d.pairedAt,
				lastSync: d.lastSync,
				fileCount: d.fileCount,
				totalSizeMb: (d.totalSizeBytes / 1024 / 1024).toFixed(2),
				enabled: d.enabled,
			})),
		};
	}

	// ---- POST /phone-backup/pair — pair a new device ----
	// Returns: token, pairing code, WebDAV URL, QR data
	@Route("POST", "/pair")
	async pair(req: any, reply: any) {
		const result = PairSchema.safeParse(req.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}

		const { deviceName } = result.data;
		const token = this.generateToken();
		const pin = result.data.pin ?? this.generatePairingCode();

		// Get host IP for the QR code
		const { execSync } = await import("node:child_process");
		const host = (() => {
			try {
				return execSync(
					"ip route show default | awk '/default/{print $3}' | head -1",
					{ encoding: "utf8" },
				).trim() || "YOUR-ARK-IP";
			} catch { return "YOUR-ARK-IP"; }
		})();

		const device: PairedDevice = {
			token,
			deviceName,
			pin,
			pairedAt: new Date().toISOString(),
			lastSync: null,
			fileCount: 0,
			totalSizeBytes: 0,
			enabled: true,
		};

		this.devices.set(token, device);
		await this.saveDevices();
		await this._api.storage.mkdir(`devices/${token}`);

		const webdavUrl = `http://${host}:3000/phone-backup/dav/${token}/`;
		const rcloneConfig = [
			`[ark-${deviceName.toLowerCase().replace(/\s+/g, "-")}]`,
			`type = webdav`,
			`url = ${webdavUrl}`,
			`vendor = other`,
		].join("\n");

		this._api.log(`Paired device: ${deviceName} (token: ${token.slice(0, 8)}...)`);

		return {
			ok: true,
			token,
			pin,
			deviceName,
			webdavUrl,
			qrData: this.generateQRText(token, host),
			rcloneConfig,
			instructions: {
				ios: `1. Open Files app → Connect to Server\n2. Enter: ${webdavUrl}\n3. PIN: ${pin}`,
				android: `1. Install FolderSync or Cx File Explorer\n2. Add WebDAV account: ${webdavUrl}\n3. PIN: ${pin}`,
				rclone: `1. Add to ~/.config/rclone/rclone.conf:\n${rcloneConfig}\n2. Run: rclone sync /storage/DCIM ark-${deviceName.toLowerCase()}:DCIM`,
			},
		};
	}

	// ---- DELETE /phone-backup/devices/:token — unpair device ----
	@Route("DELETE", "/devices/:token")
	async unpair(req: any, reply: any) {
		const { token } = req.params as { token: string };
		if (!this.devices.has(token)) {
			reply.code(404);
			return { error: "Device not found" };
		}
		this.devices.delete(token);
		await this.saveDevices();
		return { ok: true, message: "Device unpaired" };
	}

	// ---- WebDAV handler — PUT /phone-backup/dav/:token/:filename ----
	// Phones write files here via WebDAV PUT
	@Route("PUT", "/dav/:token/:filename")
	async webdavPut(req: any, reply: any) {
		const { token, filename } = req.params as { token: string; filename: string };
		const device = this.devices.get(token);

		if (!device || !device.enabled) {
			reply.code(401);
			return { error: "Invalid or disabled device token" };
		}

		const safeName = filename.replace(/[^a-zA-Z0-9._\-() ]/g, "_");
		const destPath = `devices/${token}/${safeName}`;

		try {
			await this._api.storage.save(destPath, req.body as Buffer);

			// Update device stats
			const fullPath = join(STORAGE_DIR, destPath);
			const info = await stat(fullPath).catch(() => null);
			device.fileCount = (device.fileCount ?? 0) + 1;
			device.totalSizeBytes = (device.totalSizeBytes ?? 0) + (info?.size ?? 0);
			device.lastSync = new Date().toISOString();
			await this.saveDevices();

			reply.code(201);
			return { ok: true, saved: safeName };
		} catch (err) {
			reply.code(500);
			return { error: String(err) };
		}
	}

	// ---- GET /phone-backup/dav/:token/ — WebDAV PROPFIND (list files) ----
	@Route("GET", "/dav/:token")
	async webdavList(req: any, reply: any) {
		const { token } = req.params as { token: string };
		const device = this.devices.get(token);
		if (!device || !device.enabled) {
			reply.code(401);
			return { error: "Invalid token" };
		}

		const files = await this._api.storage.list(`devices/${token}`);
		return {
			device: device.deviceName,
			files: await Promise.all(
				files.map(async (f) => {
					const fullPath = join(STORAGE_DIR, `devices/${token}`, f);
					const info = await stat(fullPath).catch(() => null);
					return {
						name: f,
						size: info?.size ?? 0,
						modified: info?.mtime.toISOString() ?? null,
						url: `/phone-backup/dav/${token}/${encodeURIComponent(f)}`,
					};
				}),
			),
		};
	}

	// ---- GET /phone-backup/dav/:token/:filename — download backed up file ----
	@Route("GET", "/dav/:token/:filename")
	async webdavGet(req: any, reply: any) {
		const { token, filename } = req.params as { token: string; filename: string };
		const device = this.devices.get(token);
		if (!device) { reply.code(401); return { error: "Invalid token" }; }

		try {
			const data = await this._api.storage.get(`devices/${token}/${filename}`);
			reply.type("application/octet-stream");
			return data;
		} catch {
			reply.code(404);
			return { error: "File not found" };
		}
	}

	// ---- GET /phone-backup/stats — overall stats ----
	@Route("GET", "/stats")
	async stats() {
		const devices = [...this.devices.values()];
		const totalFiles = devices.reduce((a, d) => a + d.fileCount, 0);
		const totalBytes = devices.reduce((a, d) => a + d.totalSizeBytes, 0);
		return {
			pairedDevices: devices.length,
			totalFiles,
			totalSizeMb: (totalBytes / 1024 / 1024).toFixed(2),
			devices: devices.map((d) => ({
				name: d.deviceName,
				lastSync: d.lastSync,
				files: d.fileCount,
			})),
		};
	}

	// ---- POST /phone-backup/devices/:token/enable|disable ----
	@Route("POST", "/devices/:token/enable")
	async enable(req: any, reply: any) { return this.toggle((req.params as any).token, true, reply); }

	@Route("POST", "/devices/:token/disable")
	async disable(req: any, reply: any) { return this.toggle((req.params as any).token, false, reply); }

	private async toggle(token: string, enabled: boolean, reply: any) {
		const device = this.devices.get(token);
		if (!device) { reply.code(404); return { error: "Device not found" }; }
		device.enabled = enabled;
		await this.saveDevices();
		return { ok: true, enabled };
	}
}
