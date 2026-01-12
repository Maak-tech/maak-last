# Zeina Voice Assistant Setup Guide

## Overview

Zeina is a real-time voice health assistant powered by OpenAI's Realtime API. This guide will help you set up and troubleshoot the voice assistant feature.

## Requirements

- **OpenAI API Key**: Required for voice assistant functionality
- **Physical Device**: Voice features work best on physical iOS/Android devices (not simulators)
- **React Native 0.62+**: For WebSocket header support
- **expo-av**: Audio recording and playback (included in dependencies)
- **Internet Connection**: Required for real-time communication with OpenAI

## Setup Instructions

### 1. Obtain OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Navigate to API Keys section
4. Click "Create new secret key"
5. Copy the key (it starts with `sk-proj-...` or `sk-...`)

### 2. Configure Environment Variables

1. Create a `.env` file in the project root (if it doesn't exist)
2. Add your OpenAI API key:

```env
# For Zeina voice assistant and AI features
OPENAI_API_KEY=sk-proj-your-actual-key-here

# Optional: Separate key specifically for Zeina
ZEINA_API_KEY=sk-proj-your-actual-key-here
```

3. **Important**: After adding/updating the `.env` file, you MUST:
   - Stop the development server
   - Restart with `npm run dev` or `npm start`
   - Rebuild the app: `npm run ios` or `npm run android`

### 3. Verify Setup

1. Launch the app on a physical device (recommended) or simulator
2. Navigate to the Zeina tab
3. Check the console logs for:
   ```
   === Zeina Voice Agent - Environment Check ===
   ✅ API key loaded successfully: sk-proj-...
   ```

## Common Issues and Solutions

### Issue: "WebSocket not connected"

**Cause**: This error usually means the WebSocket connection to OpenAI failed.

**Solutions**:

1. **Check API Key**:
   - Verify your `OPENAI_API_KEY` is set in `.env`
   - Ensure there are no extra spaces or quotes around the key
   - Confirm the key is valid on OpenAI's platform
   - Rebuild the app after changing `.env`

2. **Check Network Connection**:
   - Ensure device has internet connectivity
   - Try on a different network (some corporate networks block WebSockets)
   - Check if firewall is blocking `wss://api.openai.com`

3. **Platform-Specific Issues**:

   **iOS Simulator**:
   - Audio recording may not work on simulators
   - WebSocket connections should work but may be unstable
   - Use a physical device for best results

   **Android Emulator**:
   - Similar to iOS, use physical devices for audio features
   - Ensure emulator has network access

   **Web**:
   - WebSocket authentication headers are not supported in browsers
   - Voice features are limited on web platform
   - Consider using mobile app instead

4. **Rebuild Required**:
   ```bash
   # Stop the dev server (Ctrl+C)
   
   # Clear cache
   npm run dev:clear
   
   # Rebuild the app
   npm run ios  # For iOS
   # or
   npm run android  # For Android
   ```

### Issue: "Audio recording not available"

**Cause**: Audio modules not loaded or device doesn't support audio recording.

**Solutions**:

1. **Use Physical Device**: Simulators have limited audio support
2. **Grant Microphone Permissions**: Check device settings
3. **Reinstall Dependencies**:
   ```bash
   rm -rf node_modules
   npm install
   npm run ios  # or android
   ```

### Issue: "Property 'Constants' doesn't exist"

**Cause**: Missing import for `expo-constants`

**Solution**: This has been fixed. If you see this error:
1. Ensure you have the latest code
2. Rebuild the app

### Issue: Connection works but no audio playback

**Cause**: Audio playback issues on device

**Solutions**:

1. **Check Device Volume**: Ensure volume is up
2. **Check Silent Mode**: On iOS, disable silent mode
3. **Restart App**: Close and reopen the app
4. **Check Console**: Look for audio-related errors

## Technical Details

### WebSocket Connection

Zeina uses WebSocket connections to OpenAI's Realtime API. The connection requires:

- **URL**: `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`
- **Headers**:
  - `Authorization: Bearer YOUR_API_KEY`
  - `OpenAI-Beta: realtime=v1`

React Native's WebSocket has limited header support, so we use a custom wrapper (`websocketWithHeaders.ts`) to handle authentication.

### Audio Format

- **Input**: PCM16, 24kHz, mono
- **Output**: PCM16, 24kHz, mono
- **Encoding**: Base64 for transmission

### Voice Activity Detection (VAD)

- **Type**: Server-side VAD
- **Threshold**: 0.5
- **Silence Duration**: 500ms
- **Prefix Padding**: 300ms

## Debugging Tips

1. **Enable Detailed Logging**:
   - Check console for WebSocket connection logs
   - Look for API key validation messages
   - Monitor audio recording status

2. **Test Connection Separately**:
   - Try connecting without audio first
   - Use text messages to test basic connectivity

3. **Verify API Key**:
   ```bash
   # Run validation script
   npm run validate:env
   ```

4. **Check OpenAI API Status**:
   - Visit [OpenAI Status Page](https://status.openai.com/)
   - Verify Realtime API is operational

## Getting Help

If you continue to experience issues:

1. Check the console logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure you're using a supported device and platform
4. Check that your OpenAI API key has sufficient credits

## Features

Once connected, Zeina can:

- 🎙️ Listen to voice input with real-time transcription
- 💬 Respond with natural speech
- 🏥 Access your health data (medications, vitals, symptoms)
- 📊 Provide personalized health insights
- ⚕️ Check medication interactions
- 📅 Schedule reminders
- 🆘 Access emergency contacts

## API Costs

OpenAI's Realtime API usage is billed based on:
- Audio input tokens
- Audio output tokens
- Text tokens (for transcriptions)

Monitor your usage on the [OpenAI Usage Dashboard](https://platform.openai.com/usage).

## Security Notes

- Never commit your `.env` file to version control
- Keep your API key secure
- Rotate keys if compromised
- Monitor API usage for unexpected activity
