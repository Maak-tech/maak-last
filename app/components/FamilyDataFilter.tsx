import { ChevronDown, ChevronUp, User, Users } from "lucide-react-native";
import type React from "react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { User as UserType } from "@/types";

export interface FilterOption {
  id: string;
  type: "personal" | "family" | "member";
  label: string;
  memberId?: string;
  memberName?: string;
}

interface FamilyDataFilterProps {
  familyMembers: UserType[];
  currentUserId: string;
  selectedFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  isAdmin: boolean;
  hasFamily: boolean;
}

const FamilyDataFilter: React.FC<FamilyDataFilterProps> = ({
  familyMembers,
  currentUserId,
  selectedFilter,
  onFilterChange,
  isAdmin,
  hasFamily,
}) => {
  const { i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [animatedHeight] = useState(new Animated.Value(60));
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const isRTL = useMemo(() => i18n.language === "ar", [i18n.language]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, []);

  const filterOptions = useMemo((): FilterOption[] => {
    const options: FilterOption[] = [
      {
        id: "personal",
        type: "personal",
        label: isRTL ? "بياناتي" : "My Data",
      },
    ];

    if (hasFamily && familyMembers.length > 1) {
      options.push({
        id: "family",
        type: "family",
        label: isRTL ? "بيانات العائلة" : "Family Overview",
      });

      familyMembers
        .filter((member) => member.id !== currentUserId)
        .forEach((member) => {
          const memberName = member.firstName && member.lastName
            ? `${member.firstName} ${member.lastName}`
            : member.firstName || "User";
          
          options.push({
            id: member.id,
            type: "member",
            label: memberName,
            memberId: member.id,
            memberName,
          });
        });
    }

    return options;
  }, [familyMembers, currentUserId, hasFamily, isRTL]);

  const shouldShowExpansion = filterOptions.length > 15;

  const toggleExpansion = useCallback(() => {
    // Stop any ongoing animation
    if (animationRef.current) {
      animationRef.current.stop();
    }

    const newHeight = isExpanded
      ? 60
      : Math.min(240, 60 + Math.ceil((filterOptions.length - 15) / 3) * 40);

    const animation = Animated.timing(animatedHeight, {
      toValue: newHeight,
      duration: 300,
      useNativeDriver: false,
    });
    
    animationRef.current = animation;
    animation.start(() => {
      animationRef.current = null;
    });
    
    setIsExpanded(!isExpanded);
  }, [isExpanded, filterOptions.length, animatedHeight]);

  const renderFilterOption = useCallback((option: FilterOption) => {
    const isSelected = selectedFilter.id === option.id;
    const iconColor = isSelected ? "#FFFFFF" : "#64748B";

    const renderIcon = () => {
      switch (option.type) {
        case "personal":
          return <User color={iconColor} size={16} style={styles.filterIcon} />;
        case "family":
          return <Users color={iconColor} size={16} style={styles.filterIcon} />;
        case "member":
          return (
            <View style={[styles.memberAvatar, isSelected && styles.memberAvatarSelected]}>
              <Text style={[styles.memberAvatarText, isSelected && styles.memberAvatarTextSelected]}>
                {option.memberName?.charAt(0).toUpperCase()}
              </Text>
            </View>
          );
        default:
          return null;
      }
    };

    return (
      <TouchableOpacity
        key={option.id}
        onPress={() => onFilterChange(option)}
        style={[
          styles.filterOption,
          isSelected && styles.filterOptionSelected,
          isRTL && styles.filterOptionRTL,
        ]}
      >
        <View style={styles.filterContent}>
          {renderIcon()}
          <Text
            numberOfLines={1}
            style={[
              styles.filterText,
              isSelected && styles.filterTextSelected,
              isRTL && styles.filterTextRTL,
            ]}
          >
            {option.label}
          </Text>
        </View>

        {option.type === "member" && (
          <View style={[styles.memberBadge, isSelected && styles.memberBadgeSelected]}>
            <Text style={[styles.memberBadgeText, isSelected && styles.memberBadgeTextSelected]}>
              {isRTL ? "عضو" : "Member"}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedFilter.id, onFilterChange, isRTL]);

  const optionsToShow = useMemo(() => {
    return isExpanded || !shouldShowExpansion
      ? filterOptions
      : filterOptions.slice(0, 15);
  }, [filterOptions, isExpanded, shouldShowExpansion]);

  const filterOptionsContent = useMemo(() => {
    return (
      <View style={styles.filtersGrid}>
        {optionsToShow.map(renderFilterOption)}
      </View>
    );
  }, [optionsToShow, renderFilterOption]);

  const selectedIndicatorText = useMemo(() => {
    switch (selectedFilter.type) {
      case "family":
        return isRTL
          ? `عرض بيانات العائلة (${familyMembers.length} أعضاء)`
          : `Viewing Family Data (${familyMembers.length} members)`;
      case "member":
        return isRTL
          ? `عرض بيانات ${selectedFilter.memberName}`
          : `Viewing ${selectedFilter.memberName}'s Data`;
      default:
        return isRTL ? "عرض بياناتي الشخصية" : "Viewing My Personal Data";
    }
  }, [selectedFilter.type, selectedFilter.memberName, familyMembers.length, isRTL]);

  // Don't render if no family or if there's only personal option available
  if (!hasFamily || filterOptions.length === 1) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.headerTitleRTL]}>
          {isRTL ? "عرض البيانات" : "View Data"}
        </Text>
        {shouldShowExpansion && (
          <TouchableOpacity
            onPress={toggleExpansion}
            style={styles.expandButton}
          >
            {isExpanded ? (
              <ChevronUp color="#64748B" size={20} />
            ) : (
              <ChevronDown color="#64748B" size={20} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <Animated.View
        style={[styles.filtersContainer, { height: animatedHeight }]}
      >
        <ScrollView
          contentContainerStyle={[
            styles.filtersScrollContainer,
            isRTL && styles.filtersScrollContainerRTL,
          ]}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
        >
          {filterOptionsContent}
        </ScrollView>
      </Animated.View>

      {/* Selected Filter Indicator */}
      <View style={styles.selectedIndicator}>
        <View style={styles.selectedIndicatorDot} />
        <Text
          style={[
            styles.selectedIndicatorText,
            isRTL && styles.selectedIndicatorTextRTL,
          ]}
        >
          {selectedIndicatorText}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
  },
  headerTitleRTL: {
    fontFamily: "Geist-SemiBold",
  },
  expandButton: {
    padding: 4,
  },
  filtersContainer: {
    overflow: "hidden",
  },
  filtersScroll: {
    flex: 1,
  },
  filtersScrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filtersScrollContainerRTL: {
    flexDirection: "row-reverse",
  },
  filtersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterOption: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    marginEnd: 8,
    marginBottom: 8,
    minHeight: 36,
  },
  filterOptionSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  filterOptionRTL: {
    marginEnd: 0,
    marginStart: 8,
  },
  filterContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterIcon: {
    marginEnd: 4,
  },
  filterText: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  filterTextSelected: {
    color: "#FFFFFF",
  },
  filterTextRTL: {
    fontFamily: "Geist-Medium",
  },
  memberAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarSelected: {
    backgroundColor: "#FFFFFF",
  },
  memberAvatarText: {
    fontSize: 10,
    fontFamily: "Geist-Bold",
    color: "#64748B",
  },
  memberAvatarTextSelected: {
    color: "#2563EB",
  },
  memberBadge: {
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginStart: 6,
  },
  memberBadgeSelected: {
    backgroundColor: "#FFFFFF",
  },
  memberBadgeText: {
    fontSize: 10,
    fontFamily: "Geist-Medium",
    color: "#6366F1",
  },
  memberBadgeTextSelected: {
    color: "#2563EB",
  },
  selectedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
  },
  selectedIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563EB",
    marginEnd: 8,
  },
  selectedIndicatorText: {
    fontSize: 12,
    fontFamily: "Geist-Medium",
    color: "#64748B",
  },
  selectedIndicatorTextRTL: {
    fontFamily: "Geist-Medium",
  },
});

export default FamilyDataFilter;
