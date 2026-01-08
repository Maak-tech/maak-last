import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import Container from './Container';
import Button from './Button';
import Card from './Card';
import { Heading, Text, Caption } from './Typography';
import { colors, spacing, borderRadius } from './theme';

const MaakWelcomeScreen = () => {
  return (
    <Container gradient gradientColors={[colors.primary, colors.primaryDark]}>
      <View style={styles.header}>
        {/* Replace with your actual logo image */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>Maak</Text>
          </View>
        </View>
        
        <Heading level={1} color={colors.textLight} style={styles.title}>
          Welcome to Maak
        </Heading>
        <Caption color={colors.secondaryLight} style={styles.subtitle}>
          Connect, Create, Collaborate
        </Caption>
      </View>

      <View style={styles.cardsContainer}>
        <Card style={styles.featureCard}>
          <View style={styles.cardContent}>
            <View style={[styles.iconCircle, { backgroundColor: colors.secondaryLight }]}>
              <Text style={styles.iconText}>👥</Text>
            </View>
            <View style={styles.cardText}>
              <Text weight="semibold" size="large" style={styles.cardTitle}>
                Build Community
              </Text>
              <Caption>
                Connect with like-minded individuals and grow together
              </Caption>
            </View>
          </View>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.cardContent}>
            <View style={[styles.iconCircle, { backgroundColor: colors.secondaryLight }]}>
              <Text style={styles.iconText}>✨</Text>
            </View>
            <View style={styles.cardText}>
              <Text weight="semibold" size="large" style={styles.cardTitle}>
                Create Together
              </Text>
              <Caption>
                Collaborate on projects and bring your ideas to life
              </Caption>
            </View>
          </View>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.cardContent}>
            <View style={[styles.iconCircle, { backgroundColor: colors.secondaryLight }]}>
              <Text style={styles.iconText}>🚀</Text>
            </View>
            <View style={styles.cardText}>
              <Text weight="semibold" size="large" style={styles.cardTitle}>
                Achieve Goals
              </Text>
              <Caption>
                Track progress and celebrate achievements together
              </Caption>
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Get Started"
          onPress={() => {}}
          style={styles.primaryButton}
          fullWidth
        />
        <Button
          title="Sign In"
          onPress={() => {}}
          variant="outline"
          fullWidth
          style={styles.outlineButton}
        />
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  featureCard: {
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 28,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  buttonContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  primaryButton: {
    marginBottom: spacing.md,
    backgroundColor: colors.secondary,
  },
  outlineButton: {
    borderColor: colors.secondary,
  },
});

export default MaakWelcomeScreen;
