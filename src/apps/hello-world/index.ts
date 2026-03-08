import "reflect-metadata";
import { Module, OnInit, Route } from "../../decorators/index.ts";
import type { ArkAPI } from "../../types/module.ts";

@Module({
	name: "hello-world",
	version: "1.0.0",
	description: "Example module — demonstrates the Ark decorator API",
	icon: "👋",
	permissions: ["storage"],
})
export default class HelloWorldModule {
	declare _api: ArkAPI;

	@OnInit()
	async setup() {
		this._api.log("Module initialised via @OnInit");
		await this._api.storage.save("greeting.txt", "Greetings from Ark Node");
	}

	@Route("GET", "/ping")
	async ping() {
		return { message: "pong", module: "hello-world", version: "1.0.0" };
	}

	@Route("POST", "/echo")
	async echo(req: any) {
		return { echo: req.body };
	}
}
