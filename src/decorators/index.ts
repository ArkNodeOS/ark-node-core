import "reflect-metadata";
import type { ArkManifest, HttpMethod } from "../types/module.ts";

// ---- Metadata keys ----
export const MANIFEST_KEY = "ark:manifest";
export const ROUTES_KEY = "ark:routes";
export const INIT_KEY = "ark:init";

export interface RouteMetadata {
	method: HttpMethod;
	path: string;
	handlerKey: string;
}

// ---- @Module(manifest) ----
// Decorates a class to declare it as an Ark module.
// Example:
//   @Module({ name: "photos", version: "1.0.0", description: "...", permissions: ["storage"] })
//   class PhotosModule { ... }
export function Module(manifest: ArkManifest) {
	return (target: new (...args: any[]) => any): void => {
		Reflect.defineMetadata(MANIFEST_KEY, manifest, target);
	};
}

// ---- @Route(method, path) ----
// Registers a method as an HTTP route handler.
// Path is relative to the module prefix (/<module-name><path>).
// Example:
//   @Route("GET", "/status")
//   async getStatus(req: any, reply: any) { return { status: "ok" }; }
export function Route(method: HttpMethod, path: string) {
	return (
		target: object,
		propertyKey: string,
		_descriptor: PropertyDescriptor,
	): void => {
		const existing: RouteMetadata[] =
			Reflect.getMetadata(ROUTES_KEY, target.constructor) ?? [];
		existing.push({ method, path, handlerKey: propertyKey });
		Reflect.defineMetadata(ROUTES_KEY, existing, target.constructor);
	};
}

// ---- @OnInit() ----
// Marks a method to be called once when the module is loaded, after routes are registered.
// Useful for setting up background tasks, loading state from storage, etc.
// Example:
//   @OnInit()
//   async setup() { await this.loadConfig(); }
export function OnInit() {
	return (
		target: object,
		propertyKey: string,
		_descriptor: PropertyDescriptor,
	): void => {
		Reflect.defineMetadata(INIT_KEY, propertyKey, target.constructor);
	};
}

// ---- Introspection helpers ----
export function getManifest(
	target: new (...args: any[]) => any,
): ArkManifest | undefined {
	return Reflect.getMetadata(MANIFEST_KEY, target) as ArkManifest | undefined;
}

export function getRoutes(
	target: new (...args: any[]) => any,
): RouteMetadata[] {
	return (
		(Reflect.getMetadata(ROUTES_KEY, target) as RouteMetadata[] | undefined) ??
		[]
	);
}

export function getInitMethod(
	target: new (...args: any[]) => any,
): string | undefined {
	return Reflect.getMetadata(INIT_KEY, target) as string | undefined;
}
