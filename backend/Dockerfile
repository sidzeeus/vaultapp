FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer — only re-runs if package.json changes)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy the rest of the app
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
