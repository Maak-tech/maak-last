import { StyleSheet, View } from "react-native";

interface Props {
  children?: React.ReactNode;
  style?: object;
}

export default function WavyBackground({ children, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
