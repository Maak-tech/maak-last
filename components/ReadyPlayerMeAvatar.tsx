import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";

interface ReadyPlayerMeAvatarProps {
  avatarUrl?: string;
  size?: number;
  style?: any;
  onPress?: () => void;
  userId?: string;
}

// Ready Player Me subdomain - replace with your own from https://studio.readyplayer.me/
const READY_PLAYER_ME_SUBDOMAIN = process.env.EXPO_PUBLIC_READY_PLAYER_ME_SUBDOMAIN || "maak";

export default function ReadyPlayerMeAvatar({
  avatarUrl,
  size = 120,
  style,
  onPress,
  userId,
}: ReadyPlayerMeAvatarProps) {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // Generate HTML to display Ready Player Me avatar using their viewer
  const generateAvatarHTML = () => {
    if (!avatarUrl) {
      return generatePlaceholderHTML();
    }

    // Ready Player Me viewer URL format
    // The avatarUrl from Ready Player Me is typically a GLB file URL
    // We'll use Ready Player Me's viewer to display it
    const viewerUrl = `https://${READY_PLAYER_ME_SUBDOMAIN}.readyplayer.me/viewer?url=${encodeURIComponent(avatarUrl)}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      overflow: hidden;
      background: transparent;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    #avatar-container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
    }
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      background: transparent;
      z-index: 10;
    }
  </style>
</head>
<body>
  <div id="avatar-container">
    <div class="loading-overlay" id="loading-overlay">
      <div style="color: #2563EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px;">
        Loading...
      </div>
    </div>
    <iframe
      id="avatar-iframe"
      src="${viewerUrl}"
      allow="camera *; microphone *"
      allowfullscreen
      onload="handleAvatarLoad()"
    ></iframe>
  </div>
  <script>
    function handleAvatarLoad() {
      setTimeout(function() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
          overlay.style.display = 'none';
        }
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
        }
      }, 2000);
    }
    
    // Listen for avatar load
    window.addEventListener('load', function() {
      setTimeout(function() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
          overlay.style.display = 'none';
        }
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
        }
      }, 2000);
    });
  </script>
</body>
</html>
    `;
  };

  // Placeholder HTML when no avatar URL is provided
  const generatePlaceholderHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      overflow: hidden;
      background: transparent;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .placeholder-icon {
      font-size: ${size * 0.4}px;
      margin-bottom: 8px;
    }
    .placeholder-text {
      font-size: ${size * 0.12}px;
      text-align: center;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="placeholder">
    <div class="placeholder-icon">👤</div>
    <div class="placeholder-text">Create Avatar</div>
  </div>
  <script>
    setTimeout(function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
      }
    }, 100);
  </script>
</body>
</html>
    `;
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "loaded") {
        setLoading(false);
      }
    } catch (error) {
      // Ignore parse errors
    }
  };

  const content = (
    <View style={[{ width: size, height: size }, style]}>
      {loading && (
        <View style={[styles.loader, { width: size, height: size }]}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html: generateAvatarHTML() }}
        style={[
          styles.webview,
          { width: size, height: size, opacity: loading ? 0 : 1 },
        ]}
        onMessage={handleMessage}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  webview: {
    backgroundColor: "transparent",
  },
  loader: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    zIndex: 1,
  },
});

// Export subdomain for use in avatar creator
export { READY_PLAYER_ME_SUBDOMAIN };

