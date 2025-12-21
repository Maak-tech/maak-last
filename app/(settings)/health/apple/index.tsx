import React, { useState } from "react";
import { View, Text, Pressable, LayoutAnimation, Platform } from "react-native";
import { router } from "expo-router";

export default function AppleHealthIntroScreen() {
  const [expanded, setExpanded] = useState(false);

  const toggleLearnMore = () => {
    if (Platform.OS === "ios") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded((v) => !v);
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 12 }}>
        Connect Apple Health
      </Text>

      <Text style={{ fontSize: 16, opacity: 0.85, marginBottom: 18 }}>
        Maak can read the health data you choose to help you and your family track trends and spot risks early.
      </Text>

      <View style={{ gap: 10, marginBottom: 18 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>What we will do:</Text>
        <Text style={{ fontSize: 16 }}>• You choose what to share (pick specific metrics)</Text>
        <Text style={{ fontSize: 16 }}>• Read-only access (Maak never writes to Apple Health)</Text>
        <Text style={{ fontSize: 16 }}>• Use data to provide health insights and caregiving support</Text>
        <Text style={{ fontSize: 16 }}>• Change anytime (manage or revoke in iOS Settings)</Text>
      </View>

      <View style={{ gap: 10, marginBottom: 18, backgroundColor: "#F8F9FA", padding: 12, borderRadius: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>What we will NOT do:</Text>
        <Text style={{ fontSize: 16 }}>• We will never sell your health data</Text>
        <Text style={{ fontSize: 16 }}>• We will never share your data with third parties</Text>
        <Text style={{ fontSize: 16 }}>• We will never write to or modify your Apple Health data</Text>
        <Text style={{ fontSize: 16 }}>• Your data stays secure and private</Text>
      </View>

      <Pressable onPress={toggleLearnMore} style={{ paddingVertical: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>
          {expanded ? "Hide details" : "Learn more"}
        </Text>
      </Pressable>

      {expanded && (
        <Text style={{ fontSize: 14, opacity: 0.8, marginBottom: 18 }}>
          Apple Health uses HealthKit to store health data securely on your device. Maak uses the data you select
          to provide caregiving insights (like trends and alerts) and we do not sell your health data.
        </Text>
      )}

      <Pressable
        onPress={() => router.push("/health/apple/permissions")}
        style={{
          backgroundColor: "black",
          padding: 14,
          borderRadius: 12,
          marginTop: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
          Choose what to share
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{ padding: 14, borderRadius: 12, marginTop: 10, alignItems: "center" }}
      >
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Not now</Text>
      </Pressable>
    </View>
  );
}
