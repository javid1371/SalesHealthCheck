# Multi-stage build for Next.js standalone + Prisma (+ optional Playwright PDF)

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_DSN
ARG CACHEBUST
ENV SENTRY_DSN=$SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
RUN echo "Build cache bust: ${CACHEBUST:-none}" && npx prisma generate && npm run build && \
    npx esbuild scripts/sms-funnel-worker.ts \
      --bundle \
      --platform=node \
      --format=cjs \
      --outfile=scripts/sms-funnel-worker.bundle.cjs \
      --alias:@=./src \
      --packages=external

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PRISMA_TOOLS=/prisma-tools

ARG INSTALL_PLAYWRIGHT=false

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/config ./src/config
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --from=builder --chown=nextjs:nodejs /app/scripts/sms-funnel-worker.bundle.cjs ./scripts/sms-funnel-worker.bundle.cjs

# Prisma migrate/seed tools in a separate dir — must not overwrite standalone node_modules
RUN mkdir -p /prisma-tools && \
    cd /prisma-tools && \
    printf '%s\n' '{"name":"sales-health-check-prisma-tools"}' > package.json && \
    npm install --ignore-scripts prisma@6.19.3 @prisma/client@6.19.3 tsx@4.22.4 && \
    npx prisma generate --schema=/app/prisma/schema.prisma && \
    npm cache clean --force && \
    rm -rf /root/.npm && \
    chmod +x /app/scripts/docker-entrypoint.sh

RUN if [ "$INSTALL_PLAYWRIGHT" = "true" ]; then \
      cd /app && npm install --ignore-scripts playwright@1.61.1 && \
      npx playwright install-deps chromium && \
      npx playwright install chromium && \
      chown -R nextjs:nodejs /ms-playwright; \
    fi

RUN chown -R nextjs:nodejs /app /prisma-tools

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]
