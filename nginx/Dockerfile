FROM nginx:alpine
# Fix CRITICAL libexpat vulnerability (CVE-2026-32767)
RUN apk upgrade --no-cache libexpat && \
    rm -rf /var/cache/apk/* && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /var/run || true

COPY nginx.conf /etc/nginx/nginx.conf

USER nginx

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1