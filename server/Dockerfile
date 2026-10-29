# Контекст сборки — корень репозитория (см. docker-compose.yml).
# Цели: `runtime` (Colyseus-сервер) и `caddy` (прокси + статика web-сборок).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN pnpm --filter @party/server build
# Web-сборки всех игр -> /app/dist/web/<slug>
RUN pnpm build:web all
# Только prod-зависимости сервера (workspace-пакеты забандлены в dist)
RUN pnpm --filter @party/server --prod deploy --legacy /out

FROM caddy:2-alpine AS caddy
COPY --from=build /app/dist/web /srv/web
COPY deploy/Caddyfile /etc/caddy/Caddyfile

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data PORT=2567
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /app/server/dist ./dist
EXPOSE 2567
CMD ["node", "dist/index.js"]
