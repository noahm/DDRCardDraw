FROM node:22-bookworm AS builder
WORKDIR /app
COPY . /app/
RUN yarn install && yarn build

FROM nginx:1.31.1-alpine@sha256:8b1e78743a03dbb2c95171cc58639fef29abc8816598e27fb910ed2e621e589a
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html/
