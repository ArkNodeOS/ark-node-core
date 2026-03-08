/**
 * Isolated temp storage for tests — each test gets its own directory.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class TestStorage {
	public dir!: string;

	async setup() {
		this.dir = await mkdtemp(join(tmpdir(), "ark-test-"));
	}

	async teardown() {
		await rm(this.dir, { recursive: true, force: true });
	}
}
