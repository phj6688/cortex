FROM node:22-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/tsconfig.json server/tsup.config.ts server/
COPY web/package.json web/next.config.ts web/postcss.config.mjs web/tsconfig.json web/
RUN corepack enable && pnpm install --frozen-lockfile
COPY server/src server/src
COPY web/app web/app
COPY web/components web/components
COPY web/hooks web/hooks
COPY web/stores web/stores
COPY web/lib web/lib
COPY web/public web/public
RUN pnpm --filter @cortex-v3/server build && pnpm --filter @cortex-v3/web build

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl git ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/web/.next ./web/.next
COPY --from=builder /app/web/public ./web/public
COPY --from=builder /app/web/package.json ./web/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
ENV NODE_ENV=production
EXPOSE 3481
CMD ["node", "server/dist/index.js"]
