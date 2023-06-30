FROM registry.access.redhat.com/ubi9/nodejs-18-minimal:latest
CMD ["/usr/local/bin/node", "index.js"]
WORKDIR /home/node

COPY . build

RUN apk add -U --no-cache --virtual .build-deps git build-base \
  && sh -c 'cd build && npm install && npm run build' \
  && cp -r build/package.json build/dist/* . \
  && npm install --prod \
  && npm cache clean -f \
  && apk del .build-deps \
  && rm -rf build tmp/* /var/cache/apk/*
