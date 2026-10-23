# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Native modules (SQLite/Sharp) are installed for the VPS architecture,
# never copied from the developer's node_modules on macOS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN NODE_OPTIONS=--max-old-space-size=512 npm run build \
    && npm prune --omit=dev --no-audit --no-fund

# Build Caddy before the final app stage so a plain `docker build .` produces
# the application image. Compose still selects caddy-runtime explicitly.
FROM caddy:2-builder AS caddy-builder
# Keep the plugin build within the VPS's 2 GB memory budget. This makes the
# first build slower but avoids competing compiler workers exhausting RAM.
ENV GOMEMLIMIT=512MiB GOMAXPROCS=1
RUN xcaddy build --with github.com/caddy-dns/duckdns

FROM caddy:2-alpine AS caddy-runtime
COPY --from=caddy-builder /usr/bin/caddy /usr/bin/caddy

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8787 NODE_OPTIONS=--max-old-space-size=512
WORKDIR /app
# Certificates for Gemini HTTPS; fonts for Sharp's SVG fallback caption.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data/generated /app/data/uploads \
    && chown -R node:node /app/data
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
# The server imports the catalog and shared visitor limit at runtime.
# Keep these runtime modules explicit instead of copying the full source tree.
COPY --from=build /app/src/data.js ./src/data.js
COPY --from=build /app/src/config.js ./src/config.js
COPY server ./server
USER node
# Resolve all server imports in the final image before it can be deployed.
# Importing this module does not start the HTTP server or touch the data volume.
RUN node --input-type=module -e "await import('./server/index.js')"
EXPOSE 8787
CMD ["node", "server/index.js"]
