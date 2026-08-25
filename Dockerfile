# syntax=docker/dockerfile:1

# ---------- stage 1: build ----------
FROM node:20-alpine AS build

WORKDIR /app

# Vite inlines env vars at build time, so these have to be present *before*
# `npm run build` — passing them at `docker run` would be too late and the
# bundle would ship with empty values.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Fail loudly rather than producing an image that only breaks in the browser.
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_ANON_KEY" || { \
      echo "ERROR: build args VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required."; \
      echo "  docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... ."; \
      exit 1; \
    }

# Copy the manifests first so `npm ci` is only re-run when deps change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- stage 2: runtime ----------
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
