# Finance Dashboard v6 - Express + Static Assets
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:assets

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/index.html ./index.html
COPY --from=build /app/manage.html ./manage.html
COPY --from=build /app/favicon.svg ./favicon.svg
COPY --from=build /app/config ./config
COPY --from=build /app/css ./css
COPY --from=build /app/docs ./docs
COPY --from=build /app/js ./js
COPY --from=build /app/server ./server

EXPOSE 1234

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:1234/healthz || exit 1

CMD ["node", "server/index.js"]
