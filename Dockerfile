# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------
# PVM mobile app - web build served by nginx (development / integration)
# The API address is baked in at build time:
#   docker build --build-arg EXPO_PUBLIC_API_URL=http://localhost:8080 .
# ---------------------------------------------------------------------

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
ARG EXPO_PUBLIC_API_URL=http://localhost:8080
# Public OAuth client IDs (not secrets); empty = that sign-in button is disabled
ARG EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
ARG EXPO_PUBLIC_FACEBOOK_APP_ID=
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL \
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID \
    EXPO_PUBLIC_FACEBOOK_APP_ID=$EXPO_PUBLIC_FACEBOOK_APP_ID
RUN npx expo export --platform web --output-dir dist

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
