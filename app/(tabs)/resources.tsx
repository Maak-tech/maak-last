import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { createThemedStyles, getTextStyle } from '@/utils/styles';
import {
  Book,
  Heart,
  Pill,
  Activity,
  Users,
  Video,
  ExternalLink,
  Bookmark,
  BookOpen,
  FileText,
  Play,
  Clock,
  Star,
} from 'lucide-react-native';

interface Resource {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  category: 'general' | 'medication' | 'family' | 'symptoms' | 'lifestyle';
  type: 'article' | 'video' | 'guide' | 'checklist';
  duration?: string;
  rating?: number;
  url?: string;
  featured?: boolean;
}

const resources: Resource[] = [
  {
    id: '1',
    title: 'Understanding Medication Adherence',
    titleAr: 'فهم الالتزام بالدواء',
    description: 'Learn why taking medications as prescribed is crucial for your health',
    descriptionAr: 'تعلم لماذا تناول الأدوية كما هو موصوف أمر بالغ الأهمية لصحتك',
    category: 'medication',
    type: 'article',
    duration: '5 min',
    rating: 4.8,
    featured: true,
  },
  {
    id: '2',
    title: 'Family Health Management Best Practices',
    titleAr: 'أفضل ممارسات إدارة صحة العائلة',
    description: 'Tips for managing your family\'s health effectively using Maak',
    descriptionAr: 'نصائح لإدارة صحة عائلتك بفعالية باستخدام معاك',
    category: 'family',
    type: 'guide',
    duration: '10 min',
    rating: 4.9,
    featured: true,
  },
  {
    id: '3',
    title: 'How to Track Symptoms Effectively',
    titleAr: 'كيفية تتبع الأعراض بفعالية',
    description: 'Learn to accurately record and monitor health symptoms',
    descriptionAr: 'تعلم كيفية تسجيل ومراقبة الأعراض الصحية بدقة',
    category: 'symptoms',
    type: 'video',
    duration: '8 min',
    rating: 4.7,
  },
  {
    id: '4',
    title: 'Emergency Preparedness Checklist',
    titleAr: 'قائمة فحص الاستعداد للطوارئ',
    description: 'Essential steps to prepare for medical emergencies',
    descriptionAr: 'خطوات أساسية للاستعداد للطوارئ الطبية',
    category: 'general',
    type: 'checklist',
    duration: '3 min',
    rating: 4.6,
  },
  {
    id: '5',
    title: 'Healthy Lifestyle for Families',
    titleAr: 'نمط حياة صحي للعائلات',
    description: 'Building healthy habits that last for the whole family',
    descriptionAr: 'بناء عادات صحية دائمة للعائلة بأكملها',
    category: 'lifestyle',
    type: 'article',
    duration: '12 min',
    rating: 4.5,
  },
  {
    id: '6',
    title: 'Understanding Health Scores',
    titleAr: 'فهم نقاط الصحة',
    description: 'How Maak calculates your health score and what it means',
    descriptionAr: 'كيف يحسب معاك نقاط صحتك وما معنى ذلك',
    category: 'general',
    type: 'guide',
    duration: '6 min',
    rating: 4.4,
  },
];

const categories = [
  { key: 'all', labelEn: 'All', labelAr: 'الكل', icon: Book },
  { key: 'general', labelEn: 'General', labelAr: 'عام', icon: Heart },
  { key: 'medication', labelEn: 'Medications', labelAr: 'الأدوية', icon: Pill },
  { key: 'family', labelEn: 'Family', labelAr: 'العائلة', icon: Users },
  { key: 'symptoms', labelEn: 'Symptoms', labelAr: 'الأعراض', icon: Activity },
  { key: 'lifestyle', labelEn: 'Lifestyle', labelAr: 'نمط الحياة', icon: Star },
];

export default function ResourcesScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [bookmarkedItems, setBookmarkedItems] = useState<string[]>([]);

  const isRTL = i18n.language === 'ar';

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
    },
    headerTitle: {
      ...getTextStyle(theme, 'heading', 'bold', theme.colors.primary.main),
      fontSize: 28,
    },
    headerSubtitle: {
      ...getTextStyle(theme, 'body', 'regular', theme.colors.text.secondary),
      marginTop: 4,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
    },
    categoryTabs: {
      flexDirection: 'row' as const,
      paddingVertical: theme.spacing.base,
    },
    categoryTab: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.background.secondary,
      marginRight: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    categoryTabActive: {
      backgroundColor: theme.colors.primary.main,
    },
    categoryTabText: {
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.text.secondary),
    },
    categoryTabTextActive: {
      color: theme.colors.neutral.white,
    },
    featuredSection: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      ...getTextStyle(theme, 'subheading', 'bold', theme.colors.text.primary),
      marginBottom: theme.spacing.base,
    },
    featuredCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.base,
      ...theme.shadows.md,
    },
    featuredBadge: {
      backgroundColor: theme.colors.secondary.main,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.sm,
      alignSelf: 'flex-start' as const,
      marginBottom: theme.spacing.sm,
    },
    featuredBadgeText: {
      ...getTextStyle(theme, 'caption', 'bold', theme.colors.neutral.white),
      fontSize: 10,
    },
    resourceCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.base,
      marginBottom: theme.spacing.md,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      ...theme.shadows.sm,
    },
    resourceIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.primary[50],
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginRight: theme.spacing.md,
    },
    resourceContent: {
      flex: 1,
    },
    resourceTitle: {
      ...getTextStyle(theme, 'body', 'semibold', theme.colors.text.primary),
      marginBottom: 2,
    },
    resourceDescription: {
      ...getTextStyle(theme, 'caption', 'regular', theme.colors.text.secondary),
      marginBottom: theme.spacing.xs,
    },
    resourceMeta: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing.sm,
    },
    metaItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 2,
    },
    metaText: {
      ...getTextStyle(theme, 'caption', 'regular', theme.colors.text.tertiary),
      fontSize: 10,
    },
    resourceActions: {
      alignItems: 'center' as const,
      gap: theme.spacing.sm,
    },
    bookmarkButton: {
      padding: theme.spacing.xs,
    },
    externalLink: {
      padding: theme.spacing.xs,
    },
    onelineCard: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginVertical: theme.spacing.lg,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.secondary.main,
      alignItems: 'center' as const,
      ...theme.shadows.sm,
    },
    onelineText: {
      ...getTextStyle(theme, 'subheading', 'semibold', theme.colors.primary.main),
      fontStyle: 'italic' as const,
      textAlign: 'center' as const,
      marginBottom: theme.spacing.sm,
    },
    onelineSource: {
      ...getTextStyle(theme, 'caption', 'medium', theme.colors.secondary.main),
    },
    rtlText: {
      textAlign: 'right' as const,
    },
  }))(theme);

  const filteredResources = selectedCategory === 'all' 
    ? resources 
    : resources.filter(resource => resource.category === selectedCategory);

  const featuredResources = filteredResources.filter(r => r.featured);
  const regularResources = filteredResources.filter(r => !r.featured);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'article':
        return FileText;
      case 'video':
        return Play;
      case 'guide':
        return BookOpen;
      case 'checklist':
        return Book;
      default:
        return FileText;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'article':
        return theme.colors.primary.main;
      case 'video':
        return theme.colors.accent.error;
      case 'guide':
        return theme.colors.accent.success;
      case 'checklist':
        return theme.colors.secondary.main;
      default:
        return theme.colors.primary.main;
    }
  };

  const handleResourcePress = (resource: Resource) => {
    if (resource.url) {
      Linking.openURL(resource.url);
    } else {
      Alert.alert(
        isRTL ? 'قريباً' : 'Coming Soon',
        isRTL ? 'هذا المحتوى سيتوفر قريباً' : 'This content will be available soon'
      );
    }
  };

  const toggleBookmark = (resourceId: string) => {
    setBookmarkedItems(prev => 
      prev.includes(resourceId) 
        ? prev.filter(id => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {isRTL ? 'المصادر التعليمية' : 'Health Resources'}
        </Text>
        <Text style={[styles.headerSubtitle, isRTL && styles.rtlText]}>
          {isRTL ? 'تعلم المزيد عن الصحة والرعاية' : 'Learn more about health and care'}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Category Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryTabs}
        >
          {categories.map((category) => {
            const IconComponent = category.icon;
            const isActive = selectedCategory === category.key;
            
            return (
              <TouchableOpacity
                key={category.key}
                style={[
                  styles.categoryTab,
                  isActive && styles.categoryTabActive,
                ]}
                onPress={() => setSelectedCategory(category.key)}
              >
                <IconComponent 
                  size={16} 
                  color={isActive ? theme.colors.neutral.white : theme.colors.text.secondary} 
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    isActive && styles.categoryTabTextActive,
                    isRTL && styles.rtlText,
                  ]}
                >
                  {isRTL ? category.labelAr : category.labelEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Maak One-liner */}
        <View style={styles.onelineCard}>
          <Text style={[styles.onelineText, isRTL && styles.rtlText]}>
            {isRTL ? '"خليهم دايمًا معك"' : '"Health starts at home"'}
          </Text>
          <Text style={[styles.onelineSource, isRTL && styles.rtlText]}>
            - Maak
          </Text>
        </View>

        {/* Featured Resources */}
        {featuredResources.length > 0 && (
          <View style={styles.featuredSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
              {isRTL ? 'مصادر مميزة' : 'Featured Resources'}
            </Text>
            {featuredResources.map((resource) => {
              const TypeIcon = getTypeIcon(resource.type);
              
              return (
                <TouchableOpacity
                  key={resource.id}
                  style={styles.featuredCard}
                  onPress={() => handleResourcePress(resource)}
                >
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>
                      {isRTL ? 'مميز' : 'FEATURED'}
                    </Text>
                  </View>
                  
                  <Text style={[styles.resourceTitle, isRTL && styles.rtlText]}>
                    {isRTL ? resource.titleAr : resource.title}
                  </Text>
                  
                  <Text style={[styles.resourceDescription, isRTL && styles.rtlText]}>
                    {isRTL ? resource.descriptionAr : resource.description}
                  </Text>
                  
                  <View style={styles.resourceMeta}>
                    <View style={styles.metaItem}>
                      <TypeIcon size={12} color={theme.colors.text.tertiary} />
                      <Text style={[styles.metaText, isRTL && styles.rtlText]}>
                        {resource.type}
                      </Text>
                    </View>
                    {resource.duration && (
                      <View style={styles.metaItem}>
                        <Clock size={12} color={theme.colors.text.tertiary} />
                        <Text style={[styles.metaText, isRTL && styles.rtlText]}>
                          {resource.duration}
                        </Text>
                      </View>
                    )}
                    {resource.rating && (
                      <View style={styles.metaItem}>
                        <Star size={12} color={theme.colors.secondary.main} />
                        <Text style={[styles.metaText, isRTL && styles.rtlText]}>
                          {resource.rating}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* All Resources */}
        <View style={styles.featuredSection}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {selectedCategory === 'all' 
              ? (isRTL ? 'جميع المصادر' : 'All Resources')
              : (isRTL ? 'مصادر أخرى' : 'More Resources')}
          </Text>
          
          {regularResources.map((resource) => {
            const TypeIcon = getTypeIcon(resource.type);
            const isBookmarked = bookmarkedItems.includes(resource.id);
            
            return (
              <TouchableOpacity
                key={resource.id}
                style={styles.resourceCard}
                onPress={() => handleResourcePress(resource)}
              >
                <View style={[
                  styles.resourceIcon,
                  { backgroundColor: getTypeColor(resource.type) + '20' }
                ]}>
                  <TypeIcon size={20} color={getTypeColor(resource.type)} />
                </View>
                
                <View style={styles.resourceContent}>
                  <Text style={[styles.resourceTitle, isRTL && styles.rtlText]}>
                    {isRTL ? resource.titleAr : resource.title}
                  </Text>
                  
                  <Text style={[styles.resourceDescription, isRTL && styles.rtlText]}>
                    {isRTL ? resource.descriptionAr : resource.description}
                  </Text>
                  
                  <View style={styles.resourceMeta}>
                    {resource.duration && (
                      <View style={styles.metaItem}>
                        <Clock size={12} color={theme.colors.text.tertiary} />
                        <Text style={[styles.metaText, isRTL && styles.rtlText]}>
                          {resource.duration}
                        </Text>
                      </View>
                    )}
                    {resource.rating && (
                      <View style={styles.metaItem}>
                        <Star size={12} color={theme.colors.secondary.main} />
                        <Text style={[styles.metaText, isRTL && styles.rtlText]}>
                          {resource.rating}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.resourceActions}>
                  <TouchableOpacity
                    style={styles.bookmarkButton}
                    onPress={() => toggleBookmark(resource.id)}
                  >
                    <Bookmark 
                      size={20} 
                      color={isBookmarked ? theme.colors.secondary.main : theme.colors.text.tertiary}
                      fill={isBookmarked ? theme.colors.secondary.main : 'none'}
                    />
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.externalLink}>
                    <ExternalLink size={16} color={theme.colors.primary.main} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}