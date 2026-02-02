import { Animated, StyleSheet, Text, TextInput, View } from "react-native";
import { timingIfActive } from "../../lib/utils/animationGuards";
import { useAppStateAwareAnimation } from "../../hooks/useAppStateAwareAnimation";
import { borderRadius, colors, spacing, typography } from "./theme";

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  leftIcon,
  rightIcon,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  style,
  ...props
}) => {
  const focusAnim = useAppStateAwareAnimation(0);

  const handleFocus = () => {
    timingIfActive(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    timingIfActive(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? colors.error : colors.border, colors.primary],
  });

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, error && styles.labelError]}>{label}</Text>
      )}

      <Animated.View
        style={[
          styles.inputContainer,
          disabled && styles.inputDisabled,
          { borderColor },
          multiline && styles.multilineContainer,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onBlur={handleBlur}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          placeholder={placeholder}
          placeholderTextColor={colors.textDisabled}
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            multiline && styles.multilineInput,
          ]}
          value={value}
          {...props}
        />

        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </Animated.View>

      {(error || helperText) && (
        <Text style={[styles.helperText, error && styles.errorText]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.bodySmall,
    fontWeight: typography.weightMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  labelError: {
    color: colors.error,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  multilineContainer: {
    minHeight: 100,
    alignItems: "flex-start",
    paddingVertical: spacing.md,
  },
  inputDisabled: {
    backgroundColor: colors.background,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontSize: typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  inputWithLeftIcon: {
    marginStart: spacing.sm,
  },
  inputWithRightIcon: {
    marginEnd: spacing.sm,
  },
  leftIcon: {
    marginEnd: spacing.xs,
  },
  rightIcon: {
    marginStart: spacing.xs,
  },
  helperText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginStart: spacing.xs,
  },
  errorText: {
    color: colors.error,
  },
});

export default Input;
