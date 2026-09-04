FROM node:22-bookworm@sha256:8a34c4ab3ea2c5cd194f07e317b2a8f09461d3c8b05c4e34c8ccd56d56024c4d AS builder
WORKDIR /app
COPY . /app/
RUN yarn install && yarn build

FROM nginx:1.31.0-alpine@sha256:2f07d83bf561b506400dc183b1b2003803e39efbd22451f848adaba14d28c7c7
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html/
