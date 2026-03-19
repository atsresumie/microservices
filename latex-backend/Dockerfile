FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV REQUEST_BODY_LIMIT_BYTES=1048576
ENV LATEX_MAX_LENGTH=500000
ENV COMPILE_TIMEOUT_MS=30000
ENV TEMP_ROOT_DIR=/tmp/latex-work

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-lmodern \
  latexmk \
  texlive-fonts-recommended \
  texlive-latex-base \
  texlive-latex-recommended \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist

RUN mkdir -p /tmp/latex-work && chown -R node:node /tmp/latex-work /app
USER node

EXPOSE 8080
CMD ["node", "dist/server.js"]
