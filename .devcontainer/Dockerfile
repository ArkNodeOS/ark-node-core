FROM oven/bun:debian

# Install system deps
RUN apt-get update && apt-get install -y git rsync openssh-client curl sudo && rm -rf /var/lib/apt/lists/*

# Create a non-root user that matches typical WSL UID (1000)
# so files written inside the container are owned by you outside it
ARG USERNAME=dev
ARG USER_UID=1000
ARG USER_GID=1000
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && echo "$USERNAME ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Set working directory
WORKDIR /workspace

# Copy manifests first for layer caching (build context = repo root)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy web UI manifests and install
COPY src/web/package.json src/web/bun.lock ./src/web/
RUN cd src/web && bun install --frozen-lockfile

# Copy the full source
COPY . .

# Build the web UI
RUN cd src/web && bun run build

# Own the workspace as the non-root user
RUN chown -R $USERNAME:$USERNAME /workspace

USER $USERNAME

EXPOSE 3000

CMD ["bun", "run", "dev"]
