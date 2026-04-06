import { I18nManager } from 'react-native'
import type { FlexStyle, ViewStyle } from 'react-native'

export const isRTL = I18nManager.isRTL

/** Text alignment that starts at the reading start edge */
export const textAlignStart = isRTL ? 'right' : ('left' as 'left' | 'right')

/** Text alignment that starts at the reading end edge */
export const textAlignEnd = isRTL ? 'left' : ('right' as 'left' | 'right')

/** Row direction that follows reading direction */
export const rowDirection = isRTL ? 'row-reverse' : ('row' as FlexStyle['flexDirection'])

/** Margin on the start side (left in LTR, right in RTL) */
export function marginStart(value: number): ViewStyle {
  return isRTL ? { marginRight: value } : { marginLeft: value }
}

/** Margin on the end side */
export function marginEnd(value: number): ViewStyle {
  return isRTL ? { marginLeft: value } : { marginRight: value }
}

/** Padding on the start side */
export function paddingStart(value: number): ViewStyle {
  return isRTL ? { paddingRight: value } : { paddingLeft: value }
}

/** Padding on the end side */
export function paddingEnd(value: number): ViewStyle {
  return isRTL ? { paddingLeft: value } : { paddingRight: value }
}

/** Position an element at the start edge */
export function positionStart(value: number): ViewStyle {
  return isRTL ? { right: value } : { left: value }
}

/** Position an element at the end edge */
export function positionEnd(value: number): ViewStyle {
  return isRTL ? { left: value } : { right: value }
}
