FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# VITE_API_BASE is baked into the JS bundle at build time -- this is how the
# frontend knows where the backend lives once it's deployed.
ARG VITE_API_BASE=http://localhost:8000
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 8001
CMD ["serve", "-s", "dist", "-l", "8001"]
