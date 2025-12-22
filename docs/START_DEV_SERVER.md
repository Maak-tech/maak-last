# Starting Development Server - Quick Guide

## The Problem
The dev server needs to be running and visible so you can see the connection URL/QR code.

## Solution: Start Dev Server Manually

**Open a NEW terminal/PowerShell window** and run:

```bash
cd C:\Users\nours\Documents\GitHub\maak-last
bun run dev:tunnel
```

**OR if tunnel doesn't work, try:**

```bash
cd C:\Users\nours\Documents\GitHub\maak-last
bun run dev
```

## What You Should See

When the dev server starts, you'll see:

```
› Metro waiting on exp://192.168.1.5:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)

› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
› Press o │ open project code in your editor
› Press j │ open debugger
› Press c │ clear cache
```

**For tunnel mode, you'll also see:**
```
› Tunnel ready. Open your app and enter this URL:
  exp://[random-string].exp.direct:80
```

## Steps to Connect iPhone

1. **Start dev server** (see above) - Keep this terminal window open!
2. **Look for the connection URL** in the terminal output
3. **Open your development app** on iPhone
4. **Enter the URL** shown in terminal (or scan QR code)
5. **Connect!**

## If You Don't See Output

The dev server might be running in the background. Check:

```powershell
# Check if port 8081 is in use
netstat -an | Select-String -Pattern "8081"

# Kill any existing processes
Get-Process | Where-Object {$_.ProcessName -match "node|bun|expo"} | Stop-Process -Force
```

Then restart:
```bash
bun run dev:tunnel
```

## Connection URLs

**Local Network (faster):**
```
exp://192.168.1.5:8081
```

**Tunnel Mode (works everywhere):**
```
exp://[shown-in-terminal].exp.direct:80
```

## Important Notes

- ✅ Keep the terminal window open while developing
- ✅ The dev server must be running for your app to connect
- ✅ Tunnel mode is slower but more reliable
- ✅ Local network is faster but requires same Wi-Fi

## Troubleshooting

**"Nothing happens"**
- Make sure you're in the project directory
- Check for errors in terminal
- Try `bun run dev:clear` to clear cache

**"Can't connect"**
- Use tunnel mode: `bun run dev:tunnel`
- Check firewall settings
- Verify iPhone and computer on same network (for local mode)

