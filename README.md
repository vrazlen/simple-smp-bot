# Minecraft AFK Bot

A lightweight, headless Minecraft bot designed to keep your character active on servers. Built with [Mineflayer](https://github.com/PrismarineJS/mineflayer).

## Features
- **Headless**: Runs in the terminal, no game window required.
- **Anti-AFK**: Randomly looks around, jumps, sneaks, and swings arm to prevent kicks.
- **Auto-Reconnect**: Automatically rejoins if disconnected.
- **Auto-Login**: Supports `/login <password>` for offline/cracked servers.
- **24/7 Ready**: Includes a built-in web server for uptime monitoring (e.g., via UptimeRobot).

## Usage

### Prerequisites
- Node.js (v14 or higher)

### Installation
```bash
npm install
```

### Running the Bot
```bash
node bot.js <host> <username> <auth_type> [password]
```

**Examples:**
```bash
# Offline Server
node bot.js mc.example.com MyBot offline 123456

# Premium Server
node bot.js mc.hypixel.net myemail@example.com microsoft
```

## Hosting on Glitch (Free 24/7)
1. Import this repository to Glitch.
2. The `package.json` and `bot.js` are ready to go.
3. Use **UptimeRobot** to ping the Glitch project URL every 5 minutes to keep it awake.
