export type ArkPermission =
	| "docker"
	| "storage"
	| "network"
	| "ai"
	| "email"
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

export interface ArkAPI {
	registerRoute: (
		method: HttpMethod,
		path: string,
		handler: (req: any, reply: any) => any,
	) => void;
	storage: ArkStorageAPI;
	log: (msg: string) => void;
}

export interface ArkModule {
	manifest: ArkManifest;
	run: (api: ArkAPI) => void | Promise<void>;
}
