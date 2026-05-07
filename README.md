# ShareSecret

Secure one-time secret sharing — client-side AES-256 encryption, the key never leaves the URL fragment.

## How it works

1. You paste a secret into the browser
2. The browser generates a random AES-256-GCM key and encrypts the secret locally
3. Only the encrypted blob is sent to the server — the key stays in the URL `#fragment`
4. You share the link; the recipient clicks it, the browser decrypts the secret client-side
5. The secret is **permanently deleted** from the database after the first view

The server never sees the plaintext or the decryption key. Even a full database leak exposes nothing readable.

```
Browser                        Server / MongoDB
───────                        ────────────────
secret ──AES-256-GCM──► ciphertext ──────────► stored (TTL max 30 days)
        ↑ random key
        │
        └─► URL: /s/<uuid>#<base64url-key>
                           └── never sent to server
```

## Features

- **Zero-knowledge** — encryption key is only in the URL fragment, never transmitted
- **One-time access** — secret is deleted on first retrieval
- **Auto-expiry** — MongoDB TTL index removes secrets after 1–30 days
- **Optional description** — add context, encrypted alongside the secret
- **Dark / light mode** — respects system preference, toggle persists in localStorage
- **Rate limited** — 20 creates/hour, 100 reads/15 min per IP
- **No CDN** — all assets served self-hosted

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express 5 |
| Database | MongoDB with TTL index |
| Encryption | Web Crypto API — AES-GCM 256-bit |
| Frontend | Tailwind CSS v3, vanilla JS |
| Security | Helmet, express-rate-limit |
| Container | Docker, Docker Compose |

## Getting started

### Docker (recommended)

```bash
git clone https://github.com/lanbugs/sharesecret.git
cd sharesecret
docker compose up --build
```

Open [http://localhost:7767](http://localhost:7767).

### Local development

**Prerequisites:** Node.js 22+, MongoDB

```bash
npm install
npm run build:css
cp .env.example .env   # set MONGODB_URI
npm start
```

For CSS hot-reload during development:

```bash
npm run watch:css
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | — | MongoDB connection string |
| `PORT` | `3000` | HTTP port |

## Security notes

- HTTPS is required in production — use a reverse proxy (nginx, Traefik) with TLS
- The `Strict-Transport-Security` header is intentionally disabled in the app; configure HSTS at the reverse proxy level
- The `#` fragment is defined by RFC 7230 to never be sent in HTTP requests — this is the foundation of the zero-knowledge design

## License

MIT
