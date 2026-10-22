FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de
RUN apk upgrade --no-cache
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/slotix-web/browser/ /usr/share/nginx/html/
EXPOSE 8080
