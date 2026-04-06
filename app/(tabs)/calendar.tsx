import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusEffect } from 'expo-router';
import { createThemedStyles, getTextStyle } from '@/utils/styles';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar,
  Clock,
  Trash2,
} from 'lucide-react-native';
import { api } from '@/lib/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'appointment' | 'reminder' | 'medication' | 'lab' | 'other';

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  type: string;
  description?: string;
  color?: string;
}

interface EventFormState {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: EventType;
  notes: string;
}

const EVENT_TYPES: { value: EventType; label: string; labelAr: string; color: string }[] = [
  { value: 'appointment', label: 'Appointment', labelAr: 'موعد', color: '#6366F1' },
  { value: 'reminder', label: 'Reminder', labelAr: 'تذكير', color: '#F59E0B' },
  { value: 'medication', label: 'Medication', labelAr: 'دواء', color: '#10B981' },
  { value: 'lab', label: 'Lab Result', labelAr: 'نتيجة مختبر', color: '#3B82F6' },
  { value: 'other', label: 'Other', labelAr: 'أخرى', color: '#8B5CF6' },
];

const DAYS_OF_WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_OF_WEEK_AR = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getEventColor(type: string): string {
  return EVENT_TYPES.find((t) => t.value === type)?.color ?? '#8B5CF6';
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === 'ar';

  // Current month being displayed
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based

  // Events map: 'YYYY-MM-DD' → CalendarEvent[]
  const [eventsByDay, setEventsByDay] = useState<Record<string, CalendarEvent[]>>({});
  const [loading, setLoading] = useState(false);

  // Selected day panel
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Add/Edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EventFormState>({
    title: '',
    date: toLocalDateStr(today),
    time: '09:00',
    type: 'appointment',
    notes: '',
  });

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.base,
      backgroundColor: theme.colors.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    headerTitle: {
      ...getTextStyle(theme, 'heading', 'bold', theme.colors.primary.main),
      fontSize: 24,
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary.main,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    calendarContainer: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      margin: theme.spacing.base,
      padding: theme.spacing.base,
      ...theme.shadows.sm,
    },
    monthNav: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: theme.spacing.base,
    },
    monthTitle: {
      ...getTextStyle(theme, 'subheading', 'bold', theme.colors.text.primary),
    },
    navButton: {
      padding: theme.spacing.sm,
    },
    weekRow: {
      flexDirection: 'row' as const,
      marginBottom: theme.spacing.sm,
    },
    weekDayLabel: {
      flex: 1,
      textAlign: 'center' as const,
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.text.tertiary),
      fontSize: 11,
    },
    daysGrid: {
      gap: 0,
    },
    daysRow: {
      flexDirection: 'row' as const,
      marginBottom: 2,
    },
    dayCell: {
      flex: 1,
      height: 46,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: theme.borderRadius.sm,
    },
    dayCellSelected: {
      backgroundColor: theme.colors.primary.main,
    },
    dayCellToday: {
      borderWidth: 1,
      borderColor: theme.colors.primary.main,
    },
    dayNumber: {
      ...getTextStyle(theme, 'body', 'regular', theme.colors.text.primary),
      fontSize: 14,
    },
    dayNumberSelected: {
      color: theme.colors.neutral.white,
      fontFamily: 'Inter-Bold',
    },
    dayNumberToday: {
      color: theme.colors.primary.main,
      fontFamily: 'Inter-Bold',
    },
    dayNumberOtherMonth: {
      color: theme.colors.text.tertiary,
    },
    dotRow: {
      flexDirection: 'row' as const,
      gap: 2,
      marginTop: 2,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    // Day panel (bottom section)
    dayPanel: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
    },
    dayPanelHeader: {
      ...getTextStyle(theme, 'subheading', 'semibold', theme.colors.text.primary),
      paddingVertical: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
      marginBottom: theme.spacing.base,
    },
    noEventsText: {
      ...getTextStyle(theme, 'body', 'regular', theme.colors.text.secondary),
      textAlign: 'center' as const,
      paddingVertical: theme.spacing.xl,
    },
    eventItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.sm,
    },
    eventColorBar: {
      width: 4,
      height: '100%' as const,
      borderRadius: 2,
      marginRight: theme.spacing.base,
    },
    eventContent: {
      flex: 1,
    },
    eventTitle: {
      ...getTextStyle(theme, 'body', 'semibold', theme.colors.text.primary),
    },
    eventMeta: {
      ...getTextStyle(theme, 'caption', 'regular', theme.colors.text.secondary),
      marginTop: 2,
    },
    eventActions: {
      flexDirection: 'row' as const,
      gap: theme.spacing.sm,
    },
    eventActionBtn: {
      padding: theme.spacing.xs,
    },
    loadingOverlay: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      backgroundColor: 'rgba(0,0,0,0.15)',
      zIndex: 10,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end' as const,
    },
    modalSheet: {
      backgroundColor: theme.colors.background.secondary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: theme.spacing.xl,
      paddingBottom: theme.spacing.xl + 20,
    },
    modalHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: theme.spacing.xl,
    },
    modalTitle: {
      ...getTextStyle(theme, 'subheading', 'bold', theme.colors.text.primary),
    },
    formLabel: {
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.text.secondary),
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.base,
    },
    textInput: {
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      ...getTextStyle(theme, 'body', 'regular', theme.colors.text.primary),
      color: theme.colors.text.primary,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top' as const,
    },
    typePicker: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: theme.spacing.sm,
    },
    typeChip: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
    },
    typeChipSelected: {
      borderColor: 'transparent',
    },
    typeChipText: {
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.text.secondary),
      fontSize: 12,
    },
    typeChipTextSelected: {
      color: '#fff',
      fontFamily: 'Inter-SemiBold',
    },
    modalActions: {
      flexDirection: 'row' as const,
      gap: theme.spacing.base,
      marginTop: theme.spacing.xl,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: theme.spacing.base,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      alignItems: 'center' as const,
    },
    cancelBtnText: {
      ...getTextStyle(theme, 'button', 'medium', theme.colors.text.secondary),
    },
    saveBtn: {
      flex: 1,
      paddingVertical: theme.spacing.base,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.primary.main,
      alignItems: 'center' as const,
    },
    saveBtnText: {
      ...getTextStyle(theme, 'button', 'bold', theme.colors.neutral.white),
    },
  }))(theme);

  // ── Data fetching ────────────────────────────────────────────────────────

  const loadMonthEvents = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      const from = monthStart.toISOString();
      const to = monthEnd.toISOString();

      const events = await api.get<CalendarEvent[]>(`/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

      const byDay: Record<string, CalendarEvent[]> = {};
      for (const ev of events ?? []) {
        const dayKey = ev.startDate.slice(0, 10);
        if (!byDay[dayKey]) byDay[dayKey] = [];
        byDay[dayKey].push(ev);
      }
      setEventsByDay(byDay);
    } catch (err: unknown) {
      console.warn('[calendar] Failed to load events:', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMonthEvents(viewYear, viewMonth);
    }, [viewYear, viewMonth, loadMonthEvents])
  );

  // ── Month navigation ─────────────────────────────────────────────────────

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDay(null);
  };

  // ── Calendar grid math ───────────────────────────────────────────────────

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Build a 6-row × 7-col grid
  const totalCells = 42;
  const cells: { day: number; monthOffset: -1 | 0 | 1 }[] = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({ day: daysInPrevMonth - firstDayOfMonth + 1 + i, monthOffset: -1 });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, monthOffset: 0 });
  }
  const remaining = totalCells - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, monthOffset: 1 });
  }

  const rows: typeof cells[] = [];
  for (let r = 0; r < 6; r++) {
    rows.push(cells.slice(r * 7, r * 7 + 7));
  }

  const todayStr = toLocalDateStr(today);

  // ── Event modal logic ────────────────────────────────────────────────────

  const openAddModal = (dayStr?: string) => {
    setEditingEvent(null);
    setForm({
      title: '',
      date: dayStr ?? toLocalDateStr(today),
      time: '09:00',
      type: 'appointment',
      notes: '',
    });
    setModalVisible(true);
  };

  const openEditModal = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    const d = new Date(ev.startDate);
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    setForm({
      title: ev.title,
      date: ev.startDate.slice(0, 10),
      time: timeStr,
      type: (ev.type as EventType) || 'other',
      notes: ev.description ?? '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Validation',
        isRTL ? 'يرجى إدخال عنوان' : 'Please enter a title'
      );
      return;
    }

    // Combine date + time into ISO string
    const isoStart = `${form.date}T${form.time}:00.000Z`;
    if (isNaN(new Date(isoStart).getTime())) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'تاريخ أو وقت غير صحيح' : 'Invalid date or time');
      return;
    }

    setSaving(true);
    try {
      if (editingEvent) {
        await api.patch(`/api/calendar/${editingEvent.id}`, {
          title: form.title.trim(),
          type: form.type,
          startDate: isoStart,
          description: form.notes.trim() || undefined,
        });
      } else {
        await api.post('/api/calendar', {
          title: form.title.trim(),
          type: form.type,
          startDate: isoStart,
          description: form.notes.trim() || undefined,
        });
      }

      setModalVisible(false);
      await loadMonthEvents(viewYear, viewMonth);
    } catch (err: unknown) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'تعذر حفظ الحدث' : "Couldn't save event — check your connection"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev: CalendarEvent) => {
    Alert.alert(
      isRTL ? 'حذف الحدث' : 'Delete Event',
      isRTL ? `هل تريد حذف "${ev.title}"؟` : `Delete "${ev.title}"?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/calendar/${ev.id}`);
              await loadMonthEvents(viewYear, viewMonth);
              if (selectedDay) {
                // Deselect if no more events
                const remaining = (eventsByDay[selectedDay] ?? []).filter((e) => e.id !== ev.id);
                if (remaining.length === 0) setSelectedDay(null);
              }
            } catch (err: unknown) {
              Alert.alert(
                isRTL ? 'خطأ' : 'Error',
                isRTL ? 'تعذر حذف الحدث' : "Couldn't delete event"
              );
            }
          },
        },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : [];
  const daysOfWeek = isRTL ? DAYS_OF_WEEK_AR : DAYS_OF_WEEK_EN;
  const monthName = isRTL ? MONTH_NAMES_AR[viewMonth] : MONTH_NAMES_EN[viewMonth];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isRTL ? 'التقويم' : 'Calendar'}
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openAddModal(selectedDay ?? undefined)}>
          <Plus size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Calendar grid */}
        <View style={styles.calendarContainer}>
          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.navButton} onPress={goPrevMonth}>
              <ChevronLeft size={22} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {monthName} {viewYear}
            </Text>
            <TouchableOpacity style={styles.navButton} onPress={goNextMonth}>
              <ChevronRight size={22} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week labels */}
          <View style={styles.weekRow}>
            {daysOfWeek.map((label) => (
              <Text key={label} style={styles.weekDayLabel}>{label}</Text>
            ))}
          </View>

          {/* Day cells */}
          <View style={styles.daysGrid}>
            {loading ? (
              <ActivityIndicator
                style={{ paddingVertical: 24 }}
                color={theme.colors.primary.main}
              />
            ) : (
              rows.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.daysRow}>
                  {row.map((cell, colIdx) => {
                    const isCurrentMonth = cell.monthOffset === 0;
                    let dayStr = '';
                    if (isCurrentMonth) {
                      const m = String(viewMonth + 1).padStart(2, '0');
                      const d = String(cell.day).padStart(2, '0');
                      dayStr = `${viewYear}-${m}-${d}`;
                    }

                    const isToday = dayStr === todayStr;
                    const isSelected = dayStr !== '' && dayStr === selectedDay;
                    const dayEvents = dayStr ? (eventsByDay[dayStr] ?? []) : [];
                    // Collect up to 3 unique dot colors
                    const dotColors = [...new Set(dayEvents.map((e) => getEventColor(e.type)))].slice(0, 3);

                    return (
                      <TouchableOpacity
                        key={colIdx}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          !isSelected && isToday && styles.dayCellToday,
                        ]}
                        onPress={() => {
                          if (isCurrentMonth) {
                            setSelectedDay(dayStr === selectedDay ? null : dayStr);
                          }
                        }}
                        disabled={!isCurrentMonth}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            !isCurrentMonth && styles.dayNumberOtherMonth,
                            isSelected && styles.dayNumberSelected,
                            !isSelected && isToday && styles.dayNumberToday,
                          ]}
                        >
                          {cell.day}
                        </Text>
                        {dotColors.length > 0 && !isSelected && (
                          <View style={styles.dotRow}>
                            {dotColors.map((c, i) => (
                              <View key={i} style={[styles.dot, { backgroundColor: c }]} />
                            ))}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        </View>

        {/* Day event panel */}
        {selectedDay && (
          <View style={styles.dayPanel}>
            <Text style={styles.dayPanelHeader}>
              {isRTL
                ? `أحداث ${formatDisplayDate(selectedDay)}`
                : `Events for ${formatDisplayDate(selectedDay)}`}
            </Text>

            {selectedEvents.length === 0 ? (
              <Text style={styles.noEventsText}>
                {isRTL ? 'لا توجد أحداث في هذا اليوم' : 'No events for this day'}
              </Text>
            ) : (
              selectedEvents.map((ev) => {
                const color = getEventColor(ev.type);
                const typeInfo = EVENT_TYPES.find((t) => t.value === ev.type);
                return (
                  <View key={ev.id} style={styles.eventItem}>
                    <View style={[styles.eventColorBar, { backgroundColor: color }]} />
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle}>{ev.title}</Text>
                      <Text style={styles.eventMeta}>
                        {isRTL ? typeInfo?.labelAr : typeInfo?.label}
                        {ev.description ? ` · ${ev.description}` : ''}
                      </Text>
                    </View>
                    <View style={styles.eventActions}>
                      <TouchableOpacity
                        style={styles.eventActionBtn}
                        onPress={() => openEditModal(ev)}
                      >
                        <Calendar size={16} color={theme.colors.text.secondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.eventActionBtn}
                        onPress={() => handleDelete(ev)}
                      >
                        <Trash2 size={16} color={theme.colors.accent.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}

            {/* Inline add button for selected day */}
            <TouchableOpacity
              style={[styles.saveBtn, { marginTop: 4, marginBottom: 20 }]}
              onPress={() => openAddModal(selectedDay)}
            >
              <Text style={styles.saveBtnText}>
                {isRTL ? '+ إضافة حدث' : '+ Add Event'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add / Edit modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingEvent
                  ? (isRTL ? 'تعديل الحدث' : 'Edit Event')
                  : (isRTL ? 'إضافة حدث' : 'Add Event')}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text style={styles.formLabel}>
                {isRTL ? 'العنوان *' : 'Title *'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                placeholder={isRTL ? 'أدخل عنوان الحدث' : 'Enter event title'}
                placeholderTextColor={theme.colors.text.tertiary}
                maxLength={255}
              />

              {/* Date */}
              <Text style={styles.formLabel}>
                {isRTL ? 'التاريخ (YYYY-MM-DD)' : 'Date (YYYY-MM-DD)'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={form.date}
                onChangeText={(v) => setForm((f) => ({ ...f, date: v }))}
                placeholder="2025-12-31"
                placeholderTextColor={theme.colors.text.tertiary}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              {/* Time */}
              <Text style={styles.formLabel}>
                {isRTL ? 'الوقت (HH:MM)' : 'Time (HH:MM)'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={form.time}
                onChangeText={(v) => setForm((f) => ({ ...f, time: v }))}
                placeholder="09:00"
                placeholderTextColor={theme.colors.text.tertiary}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />

              {/* Type picker */}
              <Text style={styles.formLabel}>
                {isRTL ? 'النوع' : 'Type'}
              </Text>
              <View style={styles.typePicker}>
                {EVENT_TYPES.map((et) => {
                  const selected = form.type === et.value;
                  return (
                    <TouchableOpacity
                      key={et.value}
                      style={[
                        styles.typeChip,
                        selected && { ...styles.typeChipSelected, backgroundColor: et.color },
                      ]}
                      onPress={() => setForm((f) => ({ ...f, type: et.value }))}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          selected && styles.typeChipTextSelected,
                          !selected && { color: et.color },
                        ]}
                      >
                        {isRTL ? et.labelAr : et.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Notes */}
              <Text style={styles.formLabel}>
                {isRTL ? 'ملاحظات' : 'Notes'}
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder={isRTL ? 'ملاحظات اختيارية...' : 'Optional notes...'}
                placeholderTextColor={theme.colors.text.tertiary}
                multiline
                maxLength={5000}
              />

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelBtnText}>
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {isRTL ? 'حفظ' : 'Save'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
