FROM node:22-bookworm@sha256:363e1587494626837fa7f9a23bdb453d13b0ff3c67c705c2805cfc69c2d2fad7 AS builder
WORKDIR /app
COPY . /app/
RUN yarn install && yarn build

FROM nginx:1.31.0-alpine@sha256:2f07d83bf561b506400dc183b1b2003803e39efbd22451f848adaba14d28c7c7
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html/
