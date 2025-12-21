# Connecting iPhone to Development Server

## Current Status

✅ **Dev Server Running:** Port 8081 is active  
✅ **Your IP Address:** `192.168.1.5`  
✅ **Connection URL:** `exp://192.168.1.5:8081`

## Step-by-Step Connection Guide

### Step 1: Verify Same Network

**Critical:** Your iPhone and computer MUST be on the same Wi-Fi network.

1. On iPhone: Settings → Wi-Fi → Check network name
2. On Computer: Check Wi-Fi network name
3. **They must match exactly!**

### Step 2: Open Development App on iPhone

1. Open the development build app you installed (not Expo Go)
2. You should see a connection screen

### Step 3: Enter Connection URL

**Option A: Manual Entry**
- Tap "Enter URL manually"
- Enter: `exp://192.168.1.5:8081`
- Tap "Connect"

**Option B: Scan QR Code**
- In your terminal, look for a QR code
- Scan it with your iPhone camera
- Tap the notification to open in app

### Step 4: If Still Not Connecting

Try these solutions:

#### Solution 1: Check Windows Firewall

Windows Firewall might be blocking port 8081:

1. **Open Windows Defender Firewall:**
   - Press `Win + R`
   - Type: `wf.msc`
   - Press Enter

2. **Allow Node.js/Bun through firewall:**
   - Click "Allow an app or feature through Windows Defender Firewall"
   - Find "Node.js" or "Bun" in the list
   - Check both "Private" and "Public" boxes
   - Click OK

3. **Or create a new rule:**
   - Click "Inbound Rules" → "New Rule"
   - Select "Port" → Next
   - Select "TCP" → Specific local ports: `8081`
   - Select "Allow the connection"
   - Check all profiles (Domain, Private, Public)
   - Name it "Expo Dev Server"
   - Finish

#### Solution 2: Use Tunnel Mode (Works Across Networks)

If same network doesn't work, use tunnel mode:

```bash
# Stop current dev server (Ctrl+C)
# Then start with tunnel:
bun run dev -- --tunnel
```

**Note:** Tunnel mode is slower but works even if devices are on different networks.

#### Solution 3: Verify IP Address

Your IP might have changed. Check it:

```powershell
ipconfig | Select-String -Pattern "IPv4"
```

Update the connection URL if IP changed.

#### Solution 4: Test Connection Manually

On your iPhone, open Safari and try:
```
http://192.168.1.5:8081
```

If this doesn't load, it's a network/firewall issue.

## Troubleshooting Common Issues

### "No development server found"

**Causes:**
1. Dev server not running
2. Firewall blocking connection
3. Wrong IP address
4. Different Wi-Fi networks
5. Port 8081 blocked by router

**Solutions:**

1. **Verify dev server is running:**
   ```powershell
   netstat -an | Select-String -Pattern "8081"
   ```
   Should show `LISTENING`

2. **Check firewall:**
   - Temporarily disable Windows Firewall to test
   - If it works, firewall is the issue (re-enable and add rule)

3. **Try tunnel mode:**
   ```bash
   bun run dev -- --tunnel
   ```
   This bypasses local network issues

4. **Check router settings:**
   - Some routers block device-to-device communication
   - Try disabling "AP Isolation" or "Client Isolation" in router settings

### "Connection timeout"

**Solutions:**
- Use tunnel mode
- Check firewall settings
- Verify same network

### "Unable to connect"

**Solutions:**
- Restart dev server: `bun run dev`
- Clear cache: `bun run dev:clear`
- Try tunnel mode

## Quick Commands

```bash
# Start dev server (normal)
bun run dev

# Start dev server (tunnel mode - works across networks)
bun run dev -- --tunnel

# Start dev server (clear cache)
bun run dev:clear

# Check if server is running
netstat -an | Select-String -Pattern "8081"

# Get your IP address
ipconfig | Select-String -Pattern "IPv4"
```

## Connection URLs

**Local Network:**
```
exp://192.168.1.5:8081
```

**Tunnel Mode:**
```
exp://[tunnel-url].exp.direct:80
```
(Shown in terminal when using `--tunnel`)

## Still Not Working?

1. **Try tunnel mode** - Most reliable solution
2. **Check firewall** - Most common issue on Windows
3. **Verify network** - Must be same Wi-Fi
4. **Restart everything** - Dev server, iPhone, router

## Success Indicators

When connected successfully:
- ✅ App loads your code
- ✅ Metro bundler shows "Connected" in terminal
- ✅ Changes reload automatically
- ✅ No "development server not found" error

