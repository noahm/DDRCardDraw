FROM node:22-bookworm AS builder
WORKDIR /app
COPY . /app/
RUN yarn install && yarn build

FROM nginx:1.31.0-alpine
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html/
