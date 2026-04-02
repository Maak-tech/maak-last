import { Search, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/apiClient";

interface SearchResult {
  id: string;
  type: "medication" | "symptom" | "condition" | "vital" | "note";
  title: string;
  subtitle?: string;
  date?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ visible, onClose }: Props) {
  const { i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const isRTL = i18n.language === "ar";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bg = isDark ? "#0F172A" : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<SearchResult[]>(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );
        setResults(data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const TYPE_LABELS: Record<string, string> = {
    medication: isRTL ? "دواء" : "Medication",
    symptom:    isRTL ? "عرض" : "Symptom",
    condition:  isRTL ? "حالة" : "Condition",
    vital:      isRTL ? "قياس" : "Vital",
    note:       isRTL ? "ملاحظة" : "Note",
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: bg }]}>
        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: card, borderBottomColor: border }]}>
          <Search color={theme.colors.text.secondary} size={20} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={isRTL ? "ابحث في سجلاتك الصحية..." : "Search your health records..."}
            placeholderTextColor={theme.colors.text.secondary}
            style={[styles.searchInput, { color: theme.colors.text.primary }]}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {loading ? (
            <ActivityIndicator color={theme.colors.primary.main} size="small" />
          ) : query ? (
            <TouchableOpacity onPress={() => setQuery("")}>
              <X color={theme.colors.text.secondary} size={18} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: theme.colors.primary.main }]}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {!query.trim() && (
            <View style={styles.empty}>
              <Search color={theme.colors.text.secondary} size={40} />
              <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
                {isRTL ? "ابحث في الأدوية، الأعراض، القياسات، والملاحظات" : "Search medications, symptoms, vitals, and notes"}
              </Text>
            </View>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
                {isRTL ? `لا نتائج لـ "${query}"` : `No results for "${query}"`}
              </Text>
            </View>
          )}
          {results.map((result) => (
            <TouchableOpacity
              key={result.id}
              onPress={onClose}
              style={[styles.result, { backgroundColor: card, borderBottomColor: border }]}
            >
              <View style={[styles.typeTag, { backgroundColor: `${theme.colors.primary.main}15` }]}>
                <Text style={[styles.typeText, { color: theme.colors.primary.main }]}>
                  {TYPE_LABELS[result.type] ?? result.type}
                </Text>
              </View>
              <View style={styles.resultText}>
                <Text style={[styles.resultTitle, { color: theme.colors.text.primary }]}>
                  {result.title}
                </Text>
                {result.subtitle && (
                  <Text style={[styles.resultSub, { color: theme.colors.text.secondary }]}>
                    {result.subtitle}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  cancelBtn: { paddingLeft: 8 },
  cancelText: { fontSize: 15, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 40 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  result: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  typeTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typeText: { fontSize: 11, fontWeight: "700" },
  resultText: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: "600" },
  resultSub: { fontSize: 13, marginTop: 2 },
});
