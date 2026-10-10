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
COPY server ./server
USER node
EXPOSE 8787
CMD ["node", "server/index.js"]

# Caddy needs the DuckDNS DNS-01 provider because ports 80 and 443 are already
# occupied by another service on the VPS. DNS-01 allows valid public TLS on 8443.
FROM caddy:2-builder AS caddy-builder
RUN xcaddy build --with github.com/caddy-dns/duckdns

FROM caddy:2-alpine AS caddy-runtime
COPY --from=caddy-builder /usr/bin/caddy /usr/bin/caddy
