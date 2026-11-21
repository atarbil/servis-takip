FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    DB_KLASOR=/app/db \
    DOSYA_KLASOR=/data/dosyalar \
    TZ=Europe/Istanbul
RUN apk add --no-cache tzdata
COPY app/ /app/
COPY db/ /app/db/
RUN rm -rf /app/test && mkdir -p /data/dosyalar && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD wget -qO- http://127.0.0.1:3000/saglik || exit 1
CMD ["node", "server.js"]
