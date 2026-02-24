# deploy

A GitHub webhook server that automatically deploys projects when you push to a configured branch. Designed to run behind a Cloudflare Tunnel so your origin server is never exposed to the public internet.

## How it works

1. You push to a GitHub repository
2. GitHub sends a webhook to your Cloudflare Tunnel endpoint
3. The server verifies the HMAC signature, then runs your configured deploy steps (e.g. `git pull`, `npm install`, `pm2 restart`)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
- `PORT` - Server port (default: `9000`)
- `HOST` - Bind address (default: `127.0.0.1`)
- `WEBHOOK_SECRET` - Must match the secret in your GitHub webhook settings. Generate one with `openssl rand -hex 32`

### 3. Configure projects

```bash
cp config.example.json config.json
```

Edit `config.json` to define your projects:

```json
{
  "projects": {
    "my-project": {
      "path": "/home/user/Projects/my-project",
      "branch": "main",
      "steps": [
        "git pull origin main",
        "npm install --production",
        "pm2 restart my-project"
      ]
    }
  }
}
```

Each project key must match the GitHub repository name. The `steps` array runs sequentially in the project directory.

### 4. Set up Cloudflare Tunnel

Install `cloudflared`, then:

```bash
cloudflared tunnel login
cloudflared tunnel create deploy-webhook
cloudflared tunnel route dns deploy-webhook deploy.yourdomain.com
```

Copy and edit the tunnel config:

```bash
cp cloudflared-config.example.yml ~/.cloudflared/config.yml
# Edit with your tunnel UUID and hostname
```

Start the tunnel:

```bash
cloudflared tunnel run
```

See [cloudflared-config.example.yml](cloudflared-config.example.yml) for details.

### 5. Start the server

```bash
# With pm2
pm2 start server.js --name deploy
pm2 save

# Or directly
npm start
```

### 6. Add GitHub webhook

In your GitHub repo: Settings > Webhooks > Add webhook

- **Payload URL**: `https://deploy.yourdomain.com/webhook`
- **Content type**: `application/json`
- **Secret**: same value as `WEBHOOK_SECRET` in `.env`
- **Events**: Just the push event

## Endpoints

- `POST /webhook` - Receives GitHub webhook events
- `GET /health` - Returns `{"status":"ok"}`

## Logs

Deploy logs are written to the `logs/` directory, one file per deploy: `{project}-{timestamp}.log`

## License

MIT
