import { Platform, ViewStyle } from 'react-native'

export const shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
    } as ViewStyle,
    android: { elevation: 2 } as ViewStyle,
    default: {} as ViewStyle,
  })!,
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 6,
    } as ViewStyle,
    android: { elevation: 4 } as ViewStyle,
    default: {} as ViewStyle,
  })!,
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    } as ViewStyle,
    android: { elevation: 8 } as ViewStyle,
    default: {} as ViewStyle,
  })!,
}

export function getShadow(level: keyof typeof shadows = 'md'): ViewStyle {
  return shadows[level]
}
