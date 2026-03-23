FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8081
ENV REQUEST_BODY_LIMIT_BYTES=1048576
ENV MAX_INPUT_LENGTH=500000

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

RUN chown -R node:node /app
USER node

EXPOSE 8081
CMD ["node", "dist/server.js"]
