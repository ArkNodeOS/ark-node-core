FROM oven/bun:debian

# Install system deps
RUN apt-get update && apt-get install -y git rsync openssh-client curl sudo && rm -rf /var/lib/apt/lists/*

# Give the built-in 'bun' user (UID 1000) passwordless sudo
RUN echo "bun ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/bun \
    && chmod 0440 /etc/sudoers.d/bun

WORKDIR /workspace

# Copy manifests first for layer caching (build context = repo root)
COPY --chown=bun:bun package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy web UI manifests and install
COPY --chown=bun:bun src/web/package.json src/web/bun.lock ./src/web/
RUN cd src/web && bun install --frozen-lockfile

# Copy the full source
COPY --chown=bun:bun . .

# Build the web UI into src/web/dist/
RUN cd src/web && bun run build

USER bun

EXPOSE 3000

# Health check so Docker knows when the server is ready
HEALTHCHECK --interval=5s --timeout=3s --start-period=15s --retries=6 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use start (no --watch) — bun --watch is dev-only and breaks in daemonised containers
CMD ["bun", "run", "start"]
