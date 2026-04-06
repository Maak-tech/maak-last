import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface State { hasError: boolean; error: Error | null }

interface Props {
  children: React.ReactNode
  screenName?: string
  fallback?: React.ReactNode
}

export class ScreenErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      const Sentry = require('@sentry/react-native')
      Sentry.captureException(error, {
        extra: { componentStack: info.componentStack, screenName: this.props.screenName },
      })
    } catch {}
  }

  handleRetry = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            {this.props.screenName
              ? `The ${this.props.screenName} screen encountered an error.`
              : 'This screen encountered an error.'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry} accessibilityRole="button" accessibilityLabel="Try again">
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FAFAFA' },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#111827', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  button: { backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
