# Em3Task: kendi sunucumuzda (Hostinger VPS, Japar Akademi'nin Caddy'si arkasında)
# çalışan Docker imajı. GitHub Actions derleyip ghcr.io'ya gönderir; sunucu sadece çeker.
#
# İmaja hiçbir gizli anahtar girmez. Derlemede yalnızca tarayıcıya zaten giden,
# herkese açık NEXT_PUBLIC_ değerleri kullanılır. Gizli anahtarlar (service role,
# VAPID özel anahtarı, CRON_SECRET) sunucudaki .env dosyasından çalışırken gelir.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Tarayıcı paketine derleme sırasında gömülür
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
# Sadece iç ağda (Caddy'ye); sunucuda dışarıya port açılmaz
EXPOSE 3000
# Oturum ve veritabanı gerektirmeyen hafif bir adres: uygulama ayakta mı?
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/manifest.webmanifest || exit 1
CMD ["node", "server.js"]
