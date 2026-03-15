FROM node:20-alpine
RUN apk add --no-cache docker-cli
# node-canvas native deps (needed for dev/test, small footprint)
RUN apk add --no-cache build-base cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev
WORKDIR /app
COPY src/package.json .
RUN npm install
COPY src/ .
EXPOSE 8080
CMD ["node", "server.js"]
