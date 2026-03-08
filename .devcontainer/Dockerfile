FROM oven/bun:debian

# Install system deps
RUN apt-get update && apt-get install -y git rsync openssh-client curl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Copy manifests first for layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy web UI manifests and install
COPY src/web/package.json src/web/bun.lock* ./src/web/
RUN cd src/web && bun install --frozen-lockfile

# Copy the full source
COPY . .

# Build the web UI
RUN cd src/web && bun run build

# Expose server port
EXPOSE 3000

CMD ["bun", "run", "dev"]
