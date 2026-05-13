FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src/ ./src/
COPY shared/ /shared/
ENV NODE_PATH=/app/node_modules
EXPOSE 3001
USER node
CMD ["node", "src/index.js"]
