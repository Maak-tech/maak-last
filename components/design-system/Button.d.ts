import { ReactNode } from "react";
import { ViewStyle, TextStyle } from "react-native";

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode | null;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

declare const Button: React.FC<ButtonProps>;

export default Button;
