import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  ScrollView,
  Switch,
  TouchableOpacity,
  View,
  type TextStyle,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  dashboardWidgetService,
  type DashboardConfig,
} from "@/lib/services/dashboardWidgetService";
import { Button } from "@/components/design-system";
import { Heading, Text, Caption } from "@/components/design-system/Typography";
import { X, ChevronUp, ChevronDown } from "lucide-react-native";

interface DashboardWidgetSettingsProps {
  visible: boolean;
  onClose: () => void;
  onConfigChange?: (config: DashboardConfig) => void;
}

export default function DashboardWidgetSettings({
  visible,
  onClose,
  onConfigChange,
}: DashboardWidgetSettingsProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      loadConfig();
    }
  }, [visible, user]);

  const loadConfig = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const dashboardConfig = await dashboardWidgetService.getDashboardConfig(
        user.id
      );
      setConfig(dashboardConfig);
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWidget = async (widgetId: string) => {
    if (!user || !config) return;

    const widget = config.widgets.find((w) => w.id === widgetId);
    if (!widget) return;

    const newEnabled = !widget.enabled;
    const updatedWidgets = config.widgets.map((w) =>
      w.id === widgetId ? { ...w, enabled: newEnabled } : w
    );

    const updatedConfig: DashboardConfig = {
      ...config,
      widgets: updatedWidgets,
    };

    setConfig(updatedConfig);
    await dashboardWidgetService.toggleWidget(user.id, widgetId as any, newEnabled);
    onConfigChange?.(updatedConfig);
  };

  const handleMoveWidget = (fromIndex: number, toIndex: number) => {
    if (!config || fromIndex === toIndex) return;

    const updatedWidgets = [...config.widgets];
    const [movedWidget] = updatedWidgets.splice(fromIndex, 1);
    updatedWidgets.splice(toIndex, 0, movedWidget);

    // Update orders
    const widgetsWithOrders = updatedWidgets.map((widget, index) => ({
      ...widget,
      order: index,
    }));

    const updatedConfig: DashboardConfig = {
      ...config,
      widgets: widgetsWithOrders,
    };

    setConfig(updatedConfig);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      handleMoveWidget(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (config && index < config.widgets.length - 1) {
      handleMoveWidget(index, index + 1);
    }
  };

  const handleSave = async () => {
    if (!user || !config || saving) return;

    // Validate config before saving
    if (!config.userId || !config.widgets || !Array.isArray(config.widgets)) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? "إعدادات غير صالحة. يرجى المحاولة مرة أخرى."
          : "Invalid configuration. Please try again."
      );
      return;
    }

    setSaving(true);
    try {
      // Ensure userId matches current user
      const configToSave: DashboardConfig = {
        ...config,
        userId: user.id,
      };
      
      // Save the current config
      await dashboardWidgetService.saveDashboardConfig(configToSave);
      
      // Reload the config from server to ensure we have the latest version
      const savedConfig = await dashboardWidgetService.getDashboardConfig(user.id);
      
      // Update local state with saved config
      setConfig(savedConfig);
      
      // Notify parent component of the change
      onConfigChange?.(savedConfig);
      
      // Close the modal - changes will be visible immediately
      onClose();
    } catch (error: any) {
      // Log error for debugging
      
      // Show error to user with more details
      const errorMessage = error?.message || "Unknown error";
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL
          ? `فشل حفظ التغييرات: ${errorMessage}`
          : `Failed to save changes: ${errorMessage}`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await dashboardWidgetService.resetToDefault(user.id);
      const defaultConfig = await dashboardWidgetService.getDashboardConfig(
        user.id
      );
      setConfig(defaultConfig);
      onConfigChange?.(defaultConfig);
    } catch (error) {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const styles = getStyles(theme, isRTL);

  if (!config) {
    return null;
  }

  // Sort widgets by order for display
  const sortedWidgets = [...config.widgets].sort((a, b) => a.order - b.order);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Heading level={4} style={[styles.title, isRTL && styles.rtlText]}>
            {isRTL ? "تخصيص لوحة المعلومات" : "Customize Dashboard"}
          </Heading>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Caption 
            style={[styles.description, isRTL && styles.rtlText]}
            numberOfLines={0}
          >
            {isRTL
              ? "استخدم الأزرار لأعلى/لأسفل لإعادة ترتيب العناصر، أو قم بإيقاف تشغيل العناصر لإخفائها"
              : "Use the up/down arrows to reorder items, or toggle items to hide them"}
          </Caption>

          {/* Widget List */}
          <View style={styles.widgetList}>
            {sortedWidgets.map((widget, index) => (
              <View key={widget.id} style={styles.widgetItem}>
                <View style={styles.widgetLeft}>
                  <View style={styles.dragControls}>
                    <TouchableOpacity
                      onPress={() => handleMoveUp(index)}
                      disabled={index === 0}
                      style={[
                        styles.moveButton,
                        index === 0 && styles.moveButtonDisabled,
                      ]}
                    >
                      <ChevronUp
                        size={16}
                        color={
                          index === 0
                            ? theme.colors.text.secondary
                            : theme.colors.primary.main
                        }
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleMoveDown(index)}
                      disabled={index === sortedWidgets.length - 1}
                      style={[
                        styles.moveButton,
                        index === sortedWidgets.length - 1 && styles.moveButtonDisabled,
                      ]}
                    >
                      <ChevronDown
                        size={16}
                        color={
                          index === sortedWidgets.length - 1
                            ? theme.colors.text.secondary
                            : theme.colors.primary.main
                        }
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.widgetInfo}>
                    <Text style={[styles.widgetName, isRTL && styles.rtlText]}>
                      {dashboardWidgetService.getWidgetName(widget.id, isRTL)}
                    </Text>
                    <Caption 
                      style={styles.widgetOrder}
                      numberOfLines={1}
                    >
                      {isRTL ? `الترتيب: ${widget.order + 1}` : `Order: ${widget.order + 1}`}
                    </Caption>
                  </View>
                </View>
                <Switch
                  value={widget.enabled}
                  onValueChange={() => handleToggleWidget(widget.id)}
                  trackColor={{
                    false: typeof theme.colors.border === "string" 
                      ? theme.colors.border 
                      : theme.colors.border.medium,
                    true: theme.colors.primary.main,
                  }}
                  thumbColor={widget.enabled 
                    ? theme.colors.neutral?.white || "#FFFFFF"
                    : typeof theme.colors.border === "string"
                      ? theme.colors.border
                      : theme.colors.neutral?.[400] || "#94A3B8"
                  }
                />
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              variant="outline"
              onPress={handleReset}
              disabled={saving}
              style={styles.resetButton}
              textStyle={{}}
              title={isRTL ? "إعادة تعيين إلى الافتراضي" : "Reset to Default"}
            />
            <Button
              variant="primary"
              onPress={handleSave}
              disabled={saving}
              style={styles.saveButton}
              textStyle={{}}
              title={isRTL ? "حفظ" : "Save"}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const getStyles = (theme: any, isRTL: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: typeof theme.colors.border === "string" 
      ? theme.colors.border 
      : theme.colors.border.light,
  },
  title: {
    fontSize: 20,
    fontWeight: "600" as TextStyle["fontWeight"],
    color: theme.colors.text.primary,
  },
  rtlText: {
    textAlign: (isRTL ? "right" : "left") as TextStyle["textAlign"],
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.base,
  },
  description: {
    marginTop: theme.spacing.base,
    marginBottom: theme.spacing.lg,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  widgetList: {
    gap: theme.spacing.sm,
  },
  widgetItem: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: theme.spacing.base,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: typeof theme.colors.border === "string" 
      ? theme.colors.border 
      : theme.colors.border.light,
  },
  widgetLeft: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    flex: 1,
  },
  dragControls: {
    flexDirection: "column" as const,
    marginRight: isRTL ? 0 : theme.spacing.base,
    marginLeft: isRTL ? theme.spacing.base : 0,
    gap: 2,
  },
  moveButton: {
    padding: 4,
    borderRadius: 4,
  },
  moveButtonDisabled: {
    opacity: 0.3,
  },
  widgetInfo: {
    flex: 1,
  },
  widgetName: {
    fontSize: 16,
    fontWeight: "500" as TextStyle["fontWeight"],
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  widgetOrder: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  actions: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    gap: theme.spacing.base,
    paddingVertical: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  resetButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});
