import React, { useEffect, useRef } from 'react'
import { Animated, View, StyleSheet, ViewStyle } from 'react-native'

interface SkeletonProps {
  width: number | `${number}%`
  height: number
  borderRadius?: number
  style?: ViewStyle
}

export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius, backgroundColor: '#E5E7EB' }, { opacity }, style]}
    />
  )
}

export function MedicationCardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Skeleton width="55%" height={15} style={{ marginBottom: 6 }} />
          <Skeleton width="35%" height={12} />
        </View>
        <Skeleton width={60} height={28} borderRadius={14} />
      </View>
      <Skeleton width="80%" height={11} style={{ marginBottom: 4 }} />
      <Skeleton width="50%" height={11} />
    </View>
  )
}

export function SymptomCardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Skeleton width="45%" height={16} />
        <Skeleton width={56} height={24} borderRadius={12} />
      </View>
      <Skeleton width="70%" height={12} style={{ marginBottom: 4 }} />
      <Skeleton width="40%" height={11} />
    </View>
  )
}

export function VitalCardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Skeleton width={48} height={48} borderRadius={24} style={{ marginRight: 14 }} />
        <View style={{ flex: 1 }}>
          <Skeleton width="40%" height={13} style={{ marginBottom: 8 }} />
          <Skeleton width="30%" height={22} />
        </View>
      </View>
    </View>
  )
}

export function FamilyMemberSkeleton() {
  return (
    <View style={[skeletonStyles.card, { flexDirection: 'row', alignItems: 'center' }]}>
      <Skeleton width={52} height={52} borderRadius={26} style={{ marginRight: 14 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="50%" height={15} style={{ marginBottom: 7 }} />
        <Skeleton width="35%" height={12} />
      </View>
      <Skeleton width={32} height={32} borderRadius={16} />
    </View>
  )
}

/** @deprecated Use FamilyMemberSkeleton instead */
export const FamilyMemberCardSkeleton = FamilyMemberSkeleton

// Render N skeletons
export function SkeletonList({ count = 5, component: Component }: { count?: number; component: React.FC }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => <Component key={i} />)}
    </>
  )
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
})
