FROM node:24-slim AS builder
WORKDIR /app
COPY . /app/
RUN corepack enable && yarn --immutable && yarn build

FROM nginx:1.31.8-alpine
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html/
