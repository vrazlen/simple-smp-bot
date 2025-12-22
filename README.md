# Minecraft AFK Bot

A lightweight, headless Minecraft bot designed to keep your character active on servers. Built with Mineflayer.

## Features
- **Headless**: Runs in the terminal, no game window required.
- **Anti-AFK**: Randomly looks around, jumps, sneaks, and swings arm to prevent kicks.
- **Auto-Reconnect**: Automatically rejoins if disconnected.
- **Auto-Login**: Supports `/login <password>` for offline/cracked servers.

## Prerequisites
- Node.js (v14 or higher)

## Installation
```bash
npm install
```

## Configuration
Copy the example env file and update values as needed:
```bash
cp .env.example .env
```

Key variables:
- `BOT_HOST`, `BOT_PORT`, `BOT_USERNAME`, `BOT_AUTH` (`offline` or `microsoft`)
- `BOT_PASSWORD` (optional, for `/login` servers)
- `RECONNECT_BASE_MS`, `RECONNECT_MAX_MS` (optional backoff tuning)

CLI args override env vars:
```bash
node bot.js <host> <username> <auth_type> [password]
```

## Running the Bot
```bash
npm start -- <host> <username> <auth_type> [password]
```

Examples:
```bash
# Offline server
node bot.js mc.example.com MyBot offline 123456

# Microsoft login
node bot.js mc.hypixel.net myemail@example.com microsoft
```

## Development Commands
- `npm start` — run the bot (use `--` to pass CLI args).
- `npm test` — run the lightweight config tests.
- `npm run lint` — lint JavaScript with ESLint.
- `npm run format` — format files with Prettier.
- `npm run fix:protocol -- <mc_version>` — sync forked deps and apply protocol fallback patch (e.g., `1.21.10`).

## Rust Alternative (Azalea)
If the Node client can’t connect to your server version, use the Rust alternative with ViaVersion support.

```bash
cd rust-bot
./run.sh <host> <username> <port>
```

Environment variables:
- `BOT_HOST`, `BOT_PORT`, `BOT_USERNAME`
- `BOT_PASSWORD` (optional, sends `/login <password>` on spawn)
- `BOT_VERSION` (defaults to `1.21.10` for ViaVersion)

Notes:
- The Rust build is large on first run (several minutes).
- If you use Fedora packages, install with `sudo dnf install -y rust cargo`.

## Hosting
See `HOSTING.md` for free and self-hosting options.

## Troubleshooting
- **Unsupported protocol version**: run `npm run fix:protocol -- 1.21.10` and retry. This syncs the local forks and applies a fallback patch for newer protocols.
- **Auth errors**: double-check `BOT_AUTH` and your credentials.
- **Disconnected loop**: confirm the server is reachable and allows bots.
- **No movement**: ensure the bot actually spawned; check logs for kicks.
