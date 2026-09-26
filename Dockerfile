FROM node:22-bookworm AS builder
WORKDIR /app
COPY . /app/
RUN yarn install && yarn build

FROM nginx:1.31.5-alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html/
