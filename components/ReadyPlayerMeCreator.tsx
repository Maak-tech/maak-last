import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { READY_PLAYER_ME_SUBDOMAIN } from "./ReadyPlayerMeAvatar";

interface ReadyPlayerMeCreatorProps {
  userId: string;
  onAvatarCreated?: (avatarUrl: string) => void;
  onClose?: () => void;
}

export default function ReadyPlayerMeCreator({
  userId,
  onAvatarCreated,
  onClose,
}: ReadyPlayerMeCreatorProps) {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // Generate Ready Player Me avatar creator URL
  const getCreatorURL = () => {
    // Use Ready Player Me's avatar creator with your subdomain
    const baseURL = `https://${READY_PLAYER_ME_SUBDOMAIN}.readyplayer.me/avatar`;
    
    // Add user ID as a query parameter for tracking
    const params = new URLSearchParams({
      userId: userId,
      // You can add more customization options here
      // gender: 'neutral',
      // bodyType: 'fullbody',
    });

    return `${baseURL}?${params.toString()}`;
  };

  // Handle messages from Ready Player Me WebView
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Ready Player Me sends avatar URL when avatar is created
      if (data.type === "v1.avatar.exported" || data.eventName === "v1.avatar.exported") {
        const avatarUrl = data.url || data.avatarUrl;
        if (avatarUrl && onAvatarCreated) {
          onAvatarCreated(avatarUrl);
        }
      }
      
      // Handle other Ready Player Me events
      if (data.type === "v1.user.set" || data.eventName === "v1.user.set") {
        // User data set
      }
      
      if (data.type === "loaded" || data.eventName === "loaded") {
        setLoading(false);
      }
    } catch (error) {
      // Handle non-JSON messages or errors
      const message = event.nativeEvent.data;
      if (typeof message === "string" && message.includes("http")) {
        // Sometimes Ready Player Me sends the URL directly
        if (onAvatarCreated) {
          onAvatarCreated(message);
        }
      }
    }
  };

  // Inject JavaScript to listen for Ready Player Me events
  const injectedJavaScript = `
    (function() {
      // Listen for Ready Player Me postMessage events
      window.addEventListener('message', function(event) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          
          // Forward Ready Player Me events to React Native
          if (window.ReactNativeWebView && data) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: data.type || data.eventName,
              url: data.url || data.avatarUrl,
              eventName: data.eventName,
              ...data
            }));
          }
        } catch (e) {
          // If it's a direct URL string, send it
          if (typeof event.data === 'string' && event.data.startsWith('http')) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'v1.avatar.exported',
                url: event.data
              }));
            }
          }
        }
      });

      // Also listen for direct URL changes in iframe
      let lastUrl = window.location.href;
      setInterval(function() {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          // Check if URL contains avatar data
          if (window.location.href.includes('avatar') && window.location.href.includes('glb')) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'v1.avatar.exported',
                url: window.location.href
              }));
            }
          }
        }
      }, 1000);

      // Signal that script is injected
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'script-injected' }));
      }
    })();
    true; // Required for iOS
  `;

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: getCreatorURL() }}
        style={[styles.webview, { opacity: loading ? 0 : 1 }]}
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onLoadEnd={() => setLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn("WebView error: ", nativeEvent);
          setLoading(false);
          Alert.alert(
            "Error",
            "Failed to load avatar creator. Please check your internet connection and try again."
          );
        }}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  webview: {
    flex: 1,
  },
  loader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    zIndex: 1,
  },
});

