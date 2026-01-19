import { Link, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t("oops", "Oops!") }} />
      <View style={styles.container}>
        <Text style={styles.text}>
          {t("screenDoesNotExist", "This screen doesn't exist.")}
        </Text>
        <Link href="/" style={styles.link}>
          <Text>{t("goToHomeScreen", "Go to home screen!")}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: 600,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
