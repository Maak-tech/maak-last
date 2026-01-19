import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Badge, Divider } from "./AdditionalComponents";
import Button from "./Button";
import Card from "./Card";
import FAB from "./FAB";
import { Caption, Heading, Text } from "./Typography";
import { borderRadius, colors, spacing } from "./theme";

const MaakHomeScreen = () => {
  const [activeTab, setActiveTab] = useState("community");

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoSmall}>
            <Text style={styles.logoTextSmall}>M</Text>
          </View>
          <View>
            <Heading level={4} style={styles.headerTitle}>
              Maak
            </Heading>
            <Caption>Welcome back!</Caption>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Avatar name="User" size="md" />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Button
          onPress={() => setActiveTab("community")}
          size="small"
          style={styles.tab}
          title="Community"
          variant={activeTab === "community" ? "primary" : "ghost"}
        />
        <Button
          onPress={() => setActiveTab("projects")}
          size="small"
          style={styles.tab}
          title="Projects"
          variant={activeTab === "projects" ? "primary" : "ghost"}
        />
        <Button
          onPress={() => setActiveTab("events")}
          size="small"
          style={styles.tab}
          title="Events"
          variant={activeTab === "events" ? "primary" : "ghost"}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        {/* Stats Card */}
        <Card style={styles.statsCard} variant="elevated">
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text size="large" style={styles.statNumber} weight="bold">
                342
              </Text>
              <Caption>Members</Caption>
            </View>
            <Divider vertical />
            <View style={styles.statItem}>
              <Text size="large" style={styles.statNumber} weight="bold">
                28
              </Text>
              <Caption>Projects</Caption>
            </View>
            <Divider vertical />
            <View style={styles.statItem}>
              <Text size="large" style={styles.statNumber} weight="bold">
                12
              </Text>
              <Caption>Events</Caption>
            </View>
          </View>
        </Card>

        {/* Featured Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heading level={5}>Featured Projects</Heading>
            <Text size="small" style={styles.seeAll}>
              See all
            </Text>
          </View>

          <Card onPress={() => {}} style={styles.projectCard}>
            <View style={styles.projectHeader}>
              <Avatar name="Project Alpha" size="md" />
              <View style={styles.projectInfo}>
                <Text size="large" weight="semibold">
                  Project Alpha
                </Text>
                <Caption>Mobile App Development</Caption>
              </View>
              <Badge size="small" variant="success">
                Active
              </Badge>
            </View>
            <Divider spacing="small" />
            <Text style={styles.projectDescription}>
              Building a community-driven mobile application focused on local
              collaboration
            </Text>
            <View style={styles.projectFooter}>
              <View style={styles.avatarGroup}>
                <Avatar name="User 1" size="sm" style={styles.avatarOverlap} />
                <Avatar name="User 2" size="sm" style={styles.avatarOverlap} />
                <Avatar name="User 3" size="sm" style={styles.avatarOverlap} />
                <View style={[styles.avatarOverlap, styles.moreAvatar]}>
                  <Text size="small" weight="semibold">
                    +5
                  </Text>
                </View>
              </View>
              <Text size="small" style={styles.dueDate}>
                Due in 5 days
              </Text>
            </View>
          </Card>

          <Card onPress={() => {}} style={styles.projectCard}>
            <View style={styles.projectHeader}>
              <Avatar name="Design Sprint" size="md" />
              <View style={styles.projectInfo}>
                <Text size="large" weight="semibold">
                  Design Sprint
                </Text>
                <Caption>UI/UX Workshop</Caption>
              </View>
              <Badge size="small" variant="warning">
                Planning
              </Badge>
            </View>
            <Divider spacing="small" />
            <Text style={styles.projectDescription}>
              Collaborative design workshop to create innovative solutions for
              community challenges
            </Text>
            <View style={styles.projectFooter}>
              <View style={styles.avatarGroup}>
                <Avatar name="User 4" size="sm" style={styles.avatarOverlap} />
                <Avatar name="User 5" size="sm" style={styles.avatarOverlap} />
                <View style={[styles.avatarOverlap, styles.moreAvatar]}>
                  <Text size="small" weight="semibold">
                    +3
                  </Text>
                </View>
              </View>
              <Text size="small" style={styles.dueDate}>
                Starts tomorrow
              </Text>
            </View>
          </Card>
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heading level={5}>Upcoming Events</Heading>
            <Text size="small" style={styles.seeAll}>
              See all
            </Text>
          </View>

          <Card style={styles.eventCard}>
            <View style={styles.eventDate}>
              <Text size="large" style={styles.eventDay} weight="bold">
                15
              </Text>
              <Caption>Jan</Caption>
            </View>
            <View style={styles.eventInfo}>
              <Text weight="semibold">Monthly Meetup</Text>
              <Caption>Community Center • 6:00 PM</Caption>
            </View>
            <Button
              onPress={() => {}}
              size="small"
              style={styles.rsvpButton}
              title="RSVP"
              variant="secondary"
            />
          </Card>

          <Card style={styles.eventCard}>
            <View style={styles.eventDate}>
              <Text size="large" style={styles.eventDay} weight="bold">
                22
              </Text>
              <Caption>Jan</Caption>
            </View>
            <View style={styles.eventInfo}>
              <Text weight="semibold">Workshop: React Native</Text>
              <Caption>Online • 2:00 PM</Caption>
            </View>
            <Button
              onPress={() => {}}
              size="small"
              style={styles.rsvpButton}
              title="Join"
              variant="outline"
            />
          </Card>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        backgroundColor={colors.secondary}
        icon={<Text style={styles.fabIcon}>+</Text>}
        onPress={() => {}}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: spacing.sm,
  },
  logoTextSmall: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
  },
  headerTitle: {
    marginBottom: 0,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabs: {
    flexDirection: "row",
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tab: {
    marginEnd: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  statsCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.primary,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    color: colors.secondary,
    marginBottom: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  seeAll: {
    color: colors.secondary,
  },
  projectCard: {
    marginBottom: spacing.md,
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  projectInfo: {
    flex: 1,
    marginStart: spacing.sm,
  },
  projectDescription: {
    marginVertical: spacing.sm,
    color: colors.textSecondary,
  },
  projectFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  avatarGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarOverlap: {
    marginStart: -8,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  moreAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dueDate: {
    color: colors.textSecondary,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  eventDate: {
    width: 50,
    alignItems: "center",
    marginEnd: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.secondaryLight,
    borderRadius: borderRadius.md,
  },
  eventDay: {
    color: colors.primary,
  },
  eventInfo: {
    flex: 1,
  },
  rsvpButton: {
    minWidth: 80,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.surface,
  },
  bottomPadding: {
    height: spacing.xxl,
  },
});

export default MaakHomeScreen;
