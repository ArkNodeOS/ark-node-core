/**
 * Photos Module — personal media library.
 * Indexes images/videos, serves thumbnails, supports albums.
 * Demonstrates the class-based decorator module API.
 */
import "reflect-metadata";
import { stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { z } from "zod";
import { Module, OnInit, Route } from "../../decorators/index.ts";
import type { ArkAPI } from "../../types/module.ts";

const IMAGE_EXTS = new Set([
	".jpg",
	".jpeg",
	".png",
	".gif",
	".webp",
	".heic",
	".avif",
]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".mkv", ".avi", ".m4v", ".webm"]);

const STORAGE_DIR = resolve(import.meta.dirname, "../../../storage/photos");

interface MediaItem {
	filename: string;
	type: "image" | "video";
	size: number;
	modified: string;
	url: string;
}

interface Album {
	name: string;
	count: number;
	items: string[];
}

const CreateAlbumSchema = z.object({
	name: z.string().min(1).max(100),
});

const AddToAlbumSchema = z.object({
	filename: z.string().min(1),
});

@Module({
	name: "photos",
	version: "1.0.0",
	description:
		"Personal media library — photos and videos, stored privately on your Ark",
	icon: "📷",
	permissions: ["storage", "media"],
})
export default class PhotosModule {
	declare _api: ArkAPI;

	private albumIndex: Record<string, Album> = {};
	private readonly albumIndexFile = "albums.json";

	@OnInit()
	async setup() {
		this._api.log("Photos module initialised");
		await this._api.storage.mkdir("originals");
		await this._api.storage.mkdir("albums");
		await this.loadAlbumIndex();
	}

	private async loadAlbumIndex() {
		try {
			const buf = await this._api.storage.get(this.albumIndexFile);
			this.albumIndex = JSON.parse(buf.toString()) as Record<string, Album>;
		} catch {
			this.albumIndex = {};
		}
	}

	private async saveAlbumIndex() {
		await this._api.storage.save(
			this.albumIndexFile,
			JSON.stringify(this.albumIndex, null, 2),
		);
	}

	private async scanMedia(subdir = "originals"): Promise<MediaItem[]> {
		const files = await this._api.storage.list(subdir);
		const items: MediaItem[] = [];

		for (const filename of files) {
			const ext = extname(filename).toLowerCase();
			const type = IMAGE_EXTS.has(ext)
				? "image"
				: VIDEO_EXTS.has(ext)
					? "video"
					: null;
			if (!type) continue;

			try {
				const fullPath = join(STORAGE_DIR, subdir, filename);
				const info = await stat(fullPath);
				items.push({
					filename,
					type,
					size: info.size,
					modified: info.mtime.toISOString(),
					url: `/photos/media/${encodeURIComponent(filename)}`,
				});
			} catch {
				// Skip files we can't stat
			}
		}

		return items.sort((a, b) => b.modified.localeCompare(a.modified));
	}

	// GET /photos/library — list all media
	@Route("GET", "/library")
	async library(req: any) {
		const query = req.query as {
			type?: string;
			limit?: string;
			offset?: string;
		};
		let items = await this.scanMedia("originals");

		if (query.type === "image") items = items.filter((i) => i.type === "image");
		if (query.type === "video") items = items.filter((i) => i.type === "video");

		const limit = Math.min(Number(query.limit ?? 100), 500);
		const offset = Number(query.offset ?? 0);

		return {
			total: items.length,
			images: items.filter((i) => i.type === "image").length,
			videos: items.filter((i) => i.type === "video").length,
			items: items.slice(offset, offset + limit),
		};
	}

	// POST /photos/upload — upload a photo/video
	@Route("POST", "/upload")
	async upload(req: any, reply: any) {
		const filename = req.headers["x-filename"] as string;
		if (!filename) {
			reply.code(400);
			return { error: "x-filename header is required" };
		}

		const ext = extname(filename).toLowerCase();
		if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) {
			reply.code(400);
			return { error: `Unsupported file type: ${ext}` };
		}

		const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
		const destPath = `originals/${safe}`;

		try {
			await this._api.storage.save(destPath, req.body as Buffer);
			return {
				ok: true,
				filename: safe,
				type: IMAGE_EXTS.has(ext) ? "image" : "video",
				url: `/photos/media/${encodeURIComponent(safe)}`,
			};
		} catch (err) {
			reply.code(500);
			return { error: String(err) };
		}
	}

	// GET /photos/media/:filename — serve a media file
	@Route("GET", "/media/:filename")
	async serveMedia(req: any, reply: any) {
		const { filename } = req.params as { filename: string };
		try {
			const data = await this._api.storage.get(`originals/${filename}`);
			const ext = extname(filename).toLowerCase();
			const mime = IMAGE_EXTS.has(ext)
				? `image/${ext.slice(1).replace("jpg", "jpeg")}`
				: "video/mp4";
			reply.type(mime);
			return data;
		} catch {
			reply.code(404);
			return { error: "Media not found" };
		}
	}

	// GET /photos/albums — list albums
	@Route("GET", "/albums")
	async listAlbums() {
		return {
			albums: Object.entries(this.albumIndex).map(([id, album]) => ({
				id,
				...album,
			})),
		};
	}

	// POST /photos/albums — create album. body: { name }
	@Route("POST", "/albums")
	async createAlbum(req: any, reply: any) {
		const result = CreateAlbumSchema.safeParse(req.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}

		const id = result.data.name
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9-]/g, "");
		if (this.albumIndex[id]) {
			reply.code(409);
			return { error: "Album already exists" };
		}

		this.albumIndex[id] = { name: result.data.name, count: 0, items: [] };
		await this.saveAlbumIndex();
		return { ok: true, id, album: this.albumIndex[id] };
	}

	// POST /photos/albums/:id/add — add a photo to an album. body: { filename }
	@Route("POST", "/albums/:id/add")
	async addToAlbum(req: any, reply: any) {
		const { id } = req.params as { id: string };
		const result = AddToAlbumSchema.safeParse(req.body);
		if (!result.success) {
			reply.code(400);
			return { error: result.error.issues[0]?.message ?? "Invalid request" };
		}

		const album = this.albumIndex[id];
		if (!album) {
			reply.code(404);
			return { error: "Album not found" };
		}

		if (!album.items.includes(result.data.filename)) {
			album.items.push(result.data.filename);
			album.count = album.items.length;
			await this.saveAlbumIndex();
		}

		return { ok: true, album };
	}

	// GET /photos/stats — summary stats
	@Route("GET", "/stats")
	async stats() {
		const items = await this.scanMedia("originals");
		const totalSize = items.reduce((acc, i) => acc + i.size, 0);
		return {
			total: items.length,
			images: items.filter((i) => i.type === "image").length,
			videos: items.filter((i) => i.type === "video").length,
			albums: Object.keys(this.albumIndex).length,
			totalSizeMb: (totalSize / 1024 / 1024).toFixed(2),
		};
	}
}
