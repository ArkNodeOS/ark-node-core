import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/health", async () => {
	return { status: "ok" };
});

app.get("/status", async () => {
	return {
		cpu: process.cpuUsage(),
		memory: process.memoryUsage(),
		uptime: process.uptime(),
	};
});

const start = async () => {
	try {
		await app.listen({ port: 3000, host: "0.0.0.0" });
		console.log("Server running at http://localhost:3000");
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

start();
