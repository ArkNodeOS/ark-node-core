import type { FastifyReply, FastifyRequest } from "fastify";

export type ArkPermission =
	| "docker"
	| "storage"
	| "network"
	| "ai"
	| "email"
	| "media"
	| "system";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface ArkManifest {
	name: string;
	version: string;
	description: string;
	icon?: string;
	permissions?: ArkPermission[];
}

export interface ArkStorageAPI {
	save: (path: string, data: Buffer | string) => Promise<string>;
	get: (path: string) => Promise<Buffer>;
	list: (dir?: string) => Promise<string[]>;
	mkdir: (dir: string) => Promise<void>;
}

export interface ArkAIAPI {
	query: (prompt: string, context?: string) => Promise<string>;
}

export interface ArkAPI {
	registerRoute: (
		method: HttpMethod,
		path: string,
		handler: (req: FastifyRequest<any>, reply: FastifyReply) => any,
	) => void;
	storage: ArkStorageAPI;
	ai: ArkAIAPI;
	log: (msg: string) => void;
	warn: (msg: string) => void;
}

// Legacy functional module interface (still supported)
export interface ArkModule {
	manifest: ArkManifest;
	run: (api: ArkAPI) => void | Promise<void>;
}

// Class-based module (decorator-driven)
export type ArkModuleClass = new (...args: any[]) => ArkModuleInstance;

export interface ArkModuleInstance {
	[key: string]: any;
}
