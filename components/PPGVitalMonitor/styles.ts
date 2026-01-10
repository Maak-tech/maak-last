import { createThemedStyles, getTextStyle } from "@/utils/styles";

export const createPPGStyles = createThemedStyles((theme) => ({
  modal: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl + 40,
    paddingBottom: theme.spacing.xl,
  },
  content: {
    alignItems: "center" as const,
    width: "100%",
  },
  header: {
    width: "100%",
    alignItems: "center" as const,
    marginBottom: theme.spacing.xl,
  },
  title: {
    ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
    fontSize: 28,
    marginBottom: theme.spacing.sm,
    textAlign: "center" as const,
  },
  subtitle: {
    ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
    textAlign: "center" as const,
    marginBottom: theme.spacing.lg,
    flexWrap: "wrap" as const,
    paddingHorizontal: theme.spacing.sm,
  },
  cameraContainer: {
    width: "100%",
    height: 280,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden" as const,
    marginBottom: theme.spacing.xl,
    backgroundColor: theme.colors.background.secondary,
    ...theme.shadows.md,
  },
  camera: {
    flex: 1,
  },
  button: {
    backgroundColor: theme.colors.primary.main,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.lg,
    minWidth: 200,
    alignItems: "center" as const,
    ...theme.shadows.md,
  },
  buttonText: {
    ...getTextStyle(theme, "button", "bold", theme.colors.neutral.white),
  },
  closeButton: {
    position: "absolute" as const,
    top: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 10001,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.full,
    padding: theme.spacing.sm,
    width: 40,
    height: 40,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    ...theme.shadows.md,
    elevation: 10,
  },
}));