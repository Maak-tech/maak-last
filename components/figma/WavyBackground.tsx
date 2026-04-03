import { StyleSheet, View } from "react-native";

interface Props {
  children?: React.ReactNode;
  style?: object;
  contentPosition?: string;
  curve?: string;
  height?: number;
  variant?: string;
}

export default function WavyBackground({ children, style, contentPosition: _cp, curve: _curve, height: _h, variant: _variant }: Props) {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
