# syntax=docker/dockerfile:1
# node:22-alpine, pinned 2026-09-21
FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# jakarta.pmtiles + basemap-assets are downloaded into public/ by CI before this build
RUN npm run build

# nginxinc/nginx-unprivileged:stable-alpine, pinned 2026-09-21
FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:04a3275f25d766cff8926d2e57b2ff34a783d6b12a702dc98bb82226d2d9a508
COPY deploy/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY deploy/nginx/site.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
# hadolint ignore=DL3025
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
