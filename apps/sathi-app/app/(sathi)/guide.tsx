import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SathiBottomNav } from '@/components/shared/SathiBottomNav';
import { useExitOnBack } from '@/hooks/useExitOnBack';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { API_URL } from '@/constants/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Fallbacks if API fails
const FALLBACK_ACTIVITIES = [
  { title: 'Tea & Conversation', duration: '1-2 hours', difficulty: 'Easy' },
];
const FALLBACK_FAQS = [
  {
    question: 'What if the beneficiary seems unwell during my visit?',
    answer: 'Call Emergency Services (112) first, then contact the Program Coordinator.',
  },
];

export default function SathiGuide() {
  useExitOnBack();
  useAndroidBackHandler();
  const { width } = useWindowDimensions();

  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [bestPractices, setBestPractices] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);

  useEffect(() => {
    fetchGuideData();
  }, []);

  const fetchGuideData = async () => {
    try {
      const response = await fetch(`${API_URL}/public/sathi-guide`);
      const json = await response.json();

      if (json.success) {
        setBestPractices(json.data.bestPractices || []);
        setActivities(json.data.suggestedActivities || []);
        setFaqs(json.data.faqs || []);
      } else {
        throw new Error('Failed to fetch guide data');
      }
    } catch (error) {
      console.error('Error fetching guide data:', error);
      // Fallback
      setActivities(FALLBACK_ACTIVITIES);
      setFaqs(FALLBACK_FAQS);
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaqIndex(expandedFaqIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Saathi Guide</Text>
          <Text style={styles.headerSubtitle}>Tips and best practices for meaningful visits</Text>
        </View>

        <View style={styles.welcomeCard}>
          <Ionicons name="book-outline" size={24} color="#3B82F6" style={styles.welcomeIcon} />
          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeTitle}>Welcome to the Saathi Community!</Text>
            <Text style={styles.welcomeDesc}>
              Your time and compassion make a real difference. This guide will help you create meaningful connections and provide the best support to the seniors you visit.
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#FF7F50" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Best Practices */}
            {bestPractices.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Best Practices</Text>
                {bestPractices.map((bp) => (
                  <View key={bp.id} style={styles.bpCard}>
                    <View style={styles.bpHeader}>
                      <Ionicons name={bp.icon as any} size={20} color="#3B82F6" />
                      <Text style={styles.bpTitle}>{bp.title}</Text>
                    </View>
                    <Text style={styles.bpDesc}>{bp.description}</Text>
                    <View style={styles.bpPointsContainer}>
                      {bp.points.map((point: string, idx: number) => (
                        <View key={idx} style={styles.bpPointRow}>
                          <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
                          <Text style={styles.bpPointText}>{point}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Suggested Activities */}
            {activities.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Suggested Activities</Text>
                <View style={styles.activitiesCard}>
                  {activities.map((activity, idx) => (
                    <View
                      key={activity.id || activity.title}
                      style={[
                        styles.activityRow,
                        idx === activities.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View>
                        <Text style={styles.activityTitle}>{activity.title}</Text>
                        <View style={styles.durationRow}>
                          <Ionicons name="time-outline" size={14} color="#6B7280" />
                          <Text style={styles.activityDuration}>{activity.duration}</Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.difficultyBadge,
                          activity.difficulty === 'Easy'
                            ? styles.difficultyEasy
                            : styles.difficultyModerate,
                        ]}
                      >
                        <Text
                          style={[
                            styles.difficultyText,
                            activity.difficulty === 'Easy'
                              ? { color: '#10B981' }
                              : { color: '#F59E0B' },
                          ]}
                        >
                          {activity.difficulty}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* FAQs */}
            {faqs.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                <View style={styles.faqsContainer}>
                  {faqs.map((faq, idx) => {
                    const isExpanded = expandedFaqIndex === idx;
                    return (
                      <TouchableOpacity
                        key={faq.id || faq.question}
                        style={styles.faqItem}
                        onPress={() => toggleFaq(idx)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.faqHeader}>
                          <Text style={styles.faqQuestion}>{faq.question}</Text>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#6B7280"
                          />
                        </View>
                        {isExpanded && (
                          <View style={styles.faqAnswerContainer}>
                            <Text style={styles.faqAnswer}>{faq.answer}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Emergency Support Card */}
            <View style={styles.emergencyCard}>
              <View style={styles.emergencyHeaderRow}>
                <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
                <Text style={styles.emergencyTitle}>Emergency Support</Text>
              </View>

              <View style={styles.supportContact}>
                <Text style={styles.contactLabel}>Saathi Coordinator:</Text>
                <Text style={styles.contactValue}>+91 8827070049</Text>
              </View>

              <View style={styles.supportContact}>
                <Text style={styles.contactLabel}>Emergency Services:</Text>
                <Text style={styles.contactValue}>112</Text>
              </View>

              <Text style={styles.emergencyDesc}>
                Contact the program coordinator if you have questions, concerns, or need support with any
                aspect of your role as a Saathi.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <SathiBottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  welcomeCard: {
    flexDirection: 'row',
    backgroundColor: '#F3F8FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  welcomeIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  welcomeDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    marginTop: 8,
  },
  bpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  bpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  bpDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    marginLeft: 28,
  },
  bpPointsContainer: {
    marginTop: 4,
  },
  bpPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bpPointText: {
    fontSize: 13,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  activitiesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDuration: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyEasy: {
    backgroundColor: '#ECFDF5',
  },
  difficultyModerate: {
    backgroundColor: '#FEF3C7',
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  faqsContainer: {
    marginBottom: 24,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
    marginBottom: 10,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 16,
    lineHeight: 20,
  },
  faqAnswerContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  faqAnswer: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  emergencyCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  emergencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emergencyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  supportContact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  contactLabel: {
    fontSize: 13,
    color: '#4B5563',
  },
  contactValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  emergencyDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 12,
    lineHeight: 18,
  },
});
