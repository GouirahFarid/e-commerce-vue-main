FROM nginx:alpine AS builder
COPY nginx.conf /etc/nginx/nginx.conf

FROM nginx:alpine
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001
COPY --from=builder /etc/nginx/nginx.conf /etc/nginx/nginx.conf
RUN nginx -t
USER nginx
EXPOSE 80
