# Droplet runbook

Prereqs: Cloudflare DNS record `maps` -> droplet IP (proxied), cache rule for hostname
`maps.nizmitz.com` path `/jakarta.pmtiles` (cache eligible, edge TTL 1 month).

Certificate: the ghost nginx container mounts `/opt/ghost/certbot/conf` as `/etc/letsencrypt`
and holds one cert per host (no wildcard). Issue `maps.nizmitz.com` once with the existing
certbot service (DNS-01, works before the A record exists):

```sh
ssh nizmitz-vpn 'cd /opt/ghost && docker compose run --rm certbot certonly \
  --dns-cloudflare --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60 -d maps.nizmitz.com --non-interactive --agree-tos'
```

First deploy:

```sh
ssh nizmitz-vpn 'mkdir -p /opt/gage-jakarta'
scp deploy/docker-compose.yml nizmitz-vpn:/opt/gage-jakarta/
scp deploy/nginx/maps.conf nizmitz-vpn:/opt/ghost/nginx/conf/
# add maps.nizmitz.com to the port-80 redirect server_name list in /opt/ghost/nginx/conf/default.conf

# One-time: install cosign on the droplet so the image signature can be checked before every pull.
ssh nizmitz-vpn 'curl -sSfL -o /tmp/cosign https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 \
  && sudo install -m 0755 /tmp/cosign /usr/local/bin/cosign && rm -f /tmp/cosign'

# Verify the image is signed by this repo's CI (keyless, GitHub OIDC) before running it.
ssh nizmitz-vpn 'cosign verify \
  --certificate-identity-regexp "^https://github.com/nizmitz/gage-jakarta/" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/nizmitz/gage-jakarta:latest'

ssh nizmitz-vpn 'cd /opt/gage-jakarta && docker compose pull && docker compose up -d'
ssh nizmitz-vpn 'cd /opt/ghost && docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload'
```

Renewal: existing cron `/opt/ghost/renew_certs.sh` runs `certbot renew` for every cert under
live/, so `maps.nizmitz.com` renews with the rest.

Health: `docker inspect --format '{{.State.Health.Status}}' gage-jakarta`,
`curl -s https://maps.nizmitz.com/healthz`.
Logs: `docker logs --tail 100 gage-jakarta`. RAM: `docker stats --no-stream gage-jakarta` (limit 32m).

Smoke test after deploy/reload:

```sh
curl -sI https://maps.nizmitz.com | grep -i content-security
curl -sI -H 'Range: bytes=0-15' https://maps.nizmitz.com/jakarta.pmtiles   # expect 206
```

If RAM is tight (`free -m` available < 200MB): stop a lower-priority ghost service before
starting gage-jakarta; this container is capped at 32 MiB so it should not be the cause.

Updating the running image (new tag pushed by CI):

```sh
ssh nizmitz-vpn 'cosign verify \
  --certificate-identity-regexp "^https://github.com/nizmitz/gage-jakarta/" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  ghcr.io/nizmitz/gage-jakarta:latest'
ssh nizmitz-vpn 'cd /opt/gage-jakarta && docker compose pull && docker compose up -d'
```

If tile/basemap requests fail behind Cloudflare, check Bot Fight Mode is disabled for the
`maps.nizmitz.com` host -- it can interfere with Range requests used by the PWA's offline
service worker.
