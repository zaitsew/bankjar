# BankJar web, for the small shared server.
#
# The image is not built from source. The droplet has 1 GB of RAM and cannot run
# `next build`, so scripts/deploy.sh builds on the laptop, assembles Next's
# standalone output into dist/droplet/app/ (server.js, .next/static, public, data,
# docs, a pruned node_modules) and rsyncs it to /srv/bankjar/app/. This file is
# copied into that directory and is the whole build: one COPY, no compiler, no
# native modules (sharp and the Mac's binaries are pruned before shipping).
#
#   docker build --platform linux/amd64 -t bankjar-web dist/droplet/app

FROM node:22.23-alpine

# Lets deploy.sh prune old BankJar images without touching another product's.
LABEL app=bankjar

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=192

# Owned by the unprivileged user: Next writes revalidated pages to .next/ at run time.
COPY --chown=node:node . /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/v1/goals || exit 1

CMD ["node", "server.js"]
