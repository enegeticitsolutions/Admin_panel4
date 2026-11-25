import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  RefreshControl,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { useGlobalRefresh, emitGlobalRefresh } from '@/utils/events';
import { useAuth } from '@/contexts/AuthContext';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { format } from 'date-fns';
import { HomeHeader } from '@/components/dashboard/HomeHeader';
import { EmergencyAssistanceModal } from '@/components/shared/EmergencyAssistanceModal';
import { triggerEmergencyAlert, dialEmergencyHelpline } from '@/services/emergencyTrigger';
import {
  UpcomingVisitHeroCard,
  CompanionVisitReportModal,
  ScheduleVisit,
} from '@/components/schedule';

type ScheduleTab = 'upcoming' | 'past';

export default function ScheduleScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= 768;
  const containerMaxWidth = isTablet ? 640 : 440;

  const router = useRouter();
  const params = useLocalSearchParams<{ beneficiaryId?: string; beneficiaryName?: string }>();
  const selectedBeneficiaryId = typeof params.beneficiaryId === 'string' ? params.beneficiaryId : undefined;
  const selectedBeneficiaryName = typeof params.beneficiaryName === 'string' ? params.beneficiaryName : undefined;
  useAndroidBackHandler();

  const { user, isGuest, isLoggedIn, isLoading: authLoading, requireAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<ScheduleTab>('upcoming');
  const [isUnauthenticated, setIsUnauthenticated] = useState(false);
  const [upcomingVisits, setUpcomingVisits] = useState<ScheduleVisit[]>([]);
  const [pastVisits, setPastVisits] = useState<ScheduleVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Emergency SOS modal state
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [triggeringSos, setTriggeringSos] = useState(false);

  // Upcoming Visit Detail & Request Change modal state
  const [selectedUpcomingVisit, setSelectedUpcomingVisit] = useState<ScheduleVisit | null>(null);
  const [isChangeModalVisible, setChangeModalVisible] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [submittingChange, setSubmittingChange] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isTimePickerVisible, setTimePickerVisibility] = useState(false);

  // Past Visit Companion Report modal state
  const [selectedReportVisit, setSelectedReportVisit] = useState<ScheduleVisit | null>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = user?.name?.trim() || 'Member';

  const handleConfirmDate = (date: Date) => {
    setPreferredDate(format(date, 'MMM d, yyyy'));
    setDatePickerVisibility(false);
  };

  const handleConfirmTime = (time: Date) => {
    setPreferredTime(format(time, 'h:mm a'));
    setTimePickerVisibility(false);
  };

  const fetchVisits = useCallback(async () => {
    if (isGuest || !isLoggedIn) {
      setIsUnauthenticated(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await AsyncStorage.getItem('userToken');
      const userStr = await AsyncStorage.getItem('userData');

      if (!token || !userStr) {
        setIsUnauthenticated(true);
        setLoading(false);
        return;
      }

      setIsUnauthenticated(false);
      const parsedUser = JSON.parse(userStr);
      const targetId = selectedBeneficiaryId || parsedUser.id;

      const response = await fetch(`${API_URL}/beneficiary/${targetId}/visits`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setUpcomingVisits(data.data?.upcoming || []);
        setPastVisits(data.data?.past || []);
      } else {
        setError(data.message || 'Failed to fetch schedules');
      }
    } catch (e: any) {
      console.error('Fetch Visits Error:', e);
      setError('An error occurred while loading your schedule. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [isGuest, isLoggedIn, selectedBeneficiaryId]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      if (isGuest || !isLoggedIn) {
        setIsUnauthenticated(true);
        setLoading(false);
      } else {
        fetchVisits();
      }
    }, [authLoading, isGuest, isLoggedIn, fetchVisits])
  );

  useGlobalRefresh(() => {
    if (!isGuest && isLoggedIn) {
      fetchVisits();
    }
  });

  const onRefresh = useCallback(async () => {
    if (isGuest || !isLoggedIn) return;
    setRefreshing(true);
    await fetchVisits();
    setRefreshing(false);
  }, [isGuest, isLoggedIn, fetchVisits]);

  const handleSosPress = () => {
    if (requireAuth('Trigger emergency SOS and broadcast your live location to care responders.')) return;
    if (triggeringSos) return;
    setShowEmergencyModal(true);
  };

  const executeSosCall = async () => {
    setShowEmergencyModal(false);
    setTriggeringSos(true);
    try {
      const result = await triggerEmergencyAlert(
        'Emergency SOS triggered from Care Schedule Screen',
        { autoDial: true }
      );
      if (result.success) {
        Alert.alert(
          'Emergency Alert Sent',
          `Emergency ticket ${result.ticketNumber || 'EMG-ALERT'} has been broadcast.`
        );
      } else {
        dialEmergencyHelpline();
      }
    } catch {
      dialEmergencyHelpline();
    } finally {
      setTriggeringSos(false);
    }
  };

  const handleRequestChangePress = (visit: ScheduleVisit) => {
    if (!visit.rawScheduledTime) {
      Alert.alert('Error', 'Could not verify scheduled time.');
      return;
    }

    const now = new Date();
    const scheduledTime = new Date(visit.rawScheduledTime);
    const diffHours = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 48) {
      Alert.alert(
        'Cannot Request Change',
        'Requests to change a visit must be made at least 48 hours in advance. Please contact support.'
      );
      return;
    }

    setSelectedUpcomingVisit(null);
    setSelectedVisitId(visit.id);
    setPreferredDate('');
    setPreferredTime('');
    setChangeReason('');
    setChangeModalVisible(true);
  };

  const submitChangeRequest = async () => {
    if (!preferredDate || !preferredTime || !changeReason) {
      Alert.alert('Error', 'Please fill out all fields.');
      return;
    }

    if (!selectedVisitId) return;

    setSubmittingChange(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/beneficiary/visits/${selectedVisitId}/request-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preferredDate,
          preferredTime,
          reason: changeReason,
        }),
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Your change request has been submitted.');
        setChangeModalVisible(false);
        fetchVisits();
        emitGlobalRefresh();
      } else {
        Alert.alert('Error', data.message || 'Failed to submit request.');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setSubmittingChange(false);
    }
  };

  const featuredUpcoming = upcomingVisits.length > 0 ? upcomingVisits[0] : null;
  const laterUpcoming = upcomingVisits.length > 1 ? upcomingVisits.slice(1) : [];

  return (
    <View style={styles.screen}>
      {/* Top Header */}
      <View style={{ paddingTop: insets.top, backgroundColor: 'rgba(250, 243, 235, 0.95)' }}>
        <HomeHeader
          greeting={greeting}
          userName={userName}
          userPhoto={user?.avatarUrl}
          onSosPress={handleSosPress}
          triggeringSos={triggeringSos}
        />
      </View>

      {loading || authLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FE6700" />
          <Text style={styles.loaderText}>Loading care schedule...</Text>
        </View>
      ) : isUnauthenticated || isGuest || !isLoggedIn ? (
        <ScrollView
          contentContainerStyle={[
            styles.guestContent,
            { maxWidth: containerMaxWidth, paddingBottom: 112 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.guestCard}>
            <View style={styles.guestBadge}>
              <Feather name="calendar" size={13} color="#FE6700" />
              <Text style={styles.guestBadgeText}>Saathi Care Visits</Text>
            </View>

            <View style={styles.guestIconWrap}>
              <MaterialCommunityIcons name="calendar-clock" size={40} color="#FE6700" />
            </View>

            <Text style={styles.guestTitle}>Track Every Care Visit</Text>
            <Text style={styles.guestDesc}>
              Sign in or create an account to view upcoming Saathi companion visits, arrival windows, and detailed past visit reports.
            </Text>

            <TouchableOpacity
              style={styles.guestPrimaryBtn}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.85}
            >
              <Text style={styles.guestPrimaryBtnText}>Create Free Account</Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.guestSecondaryBtn}
              onPress={() => router.push('/(auth)')}
              activeOpacity={0.75}
            >
              <Text style={styles.guestSecondaryBtnText}>
                Already have an account? <Text style={styles.guestSecondaryLink}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : error ? (
        <View style={styles.centerContainer}>
          <View style={styles.errorIconWrap}>
            <Feather name="wifi-off" size={28} color="#D97706" />
          </View>
          <Text style={styles.errorTitle}>Unable to Load Schedule</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchVisits} activeOpacity={0.85}>
            <Feather name="refresh-cw" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { maxWidth: containerMaxWidth, paddingBottom: 112 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FE6700']}
              tintColor="#FE6700"
            />
          }
        >
          {/* Title Section */}
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>
              {selectedBeneficiaryName ? `VISITS & SUPPORT · ${selectedBeneficiaryName.toUpperCase()}` : 'VISITS & SUPPORT'}
            </Text>
            <Text style={styles.pageTitle}>Care schedule</Text>
          </View>

          {/* Segmented Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'upcoming' && styles.tabBtnActive]}
              onPress={() => setActiveTab('upcoming')}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
                Upcoming
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'past' && styles.tabBtnActive]}
              onPress={() => setActiveTab('past')}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
                Past
              </Text>
            </TouchableOpacity>
          </View>

          {/* UPCOMING TAB */}
          {activeTab === 'upcoming' ? (
            <View style={styles.tabBody}>
              {featuredUpcoming ? (
                <UpcomingVisitHeroCard
                  visit={featuredUpcoming}
                  onViewDetails={(v) => setSelectedUpcomingVisit(v)}
                />
              ) : (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconBox}>
                    <Feather name="calendar" size={22} color="#FE6700" />
                  </View>
                  <Text style={styles.emptyTitle}>No upcoming visits scheduled</Text>
                  <Text style={styles.emptySubtitle}>
                    Your upcoming Saathi companion visits and arrival windows will appear here.
                  </Text>
                </View>
              )}

              {/* Later this week */}
              {laterUpcoming.length > 0 && (
                <View style={styles.laterSection}>
                  <Text style={styles.laterHeading}>Later this week</Text>
                  <View style={styles.laterList}>
                    {laterUpcoming.map((visit) => (
                      <TouchableOpacity
                        key={visit.id}
                        style={styles.laterCard}
                        onPress={() => setSelectedUpcomingVisit(visit)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.dateBadge}>
                          <Text style={styles.dateBadgeDay}>{visit.dayShort || 'DAY'}</Text>
                          <Text style={styles.dateBadgeNum}>{visit.dayNumber || '--'}</Text>
                        </View>

                        <View style={styles.laterInfo}>
                          <Text style={styles.laterTitle} numberOfLines={1}>
                            {visit.title}
                          </Text>
                          <Text style={styles.laterSub} numberOfLines={1}>
                            {visit.beneficiaryName ? `${visit.beneficiaryName} · ` : ''}
                            {visit.time}
                          </Text>
                        </View>

                        <Feather name="chevron-right" size={22} color="#667085" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* PAST TAB (Powered by Timeline Encounter Data) */
            <View style={styles.tabBody}>
              {pastVisits.length > 0 ? (
                <View style={styles.pastList}>
                  {pastVisits.map((visit) => {
                    const isCancelled = visit.status === 'cancelled';
                    const statusText =
                      visit.status === 'completed'
                        ? 'Completed'
                        : isCancelled
                        ? 'Cancelled'
                        : visit.status.charAt(0).toUpperCase() + visit.status.slice(1);
                    const companionShort =
                      visit.companionFirstName || visit.companionName?.split(' ')[0] || 'Companion';

                    return (
                      <TouchableOpacity
                        key={visit.id}
                        style={styles.pastCard}
                        onPress={() => setSelectedReportVisit(visit)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.pastTopRow}>
                          <View
                            style={[
                              styles.pastIconSquare,
                              isCancelled && { backgroundColor: '#FEF2F2' },
                            ]}
                          >
                            <Feather
                              name={isCancelled ? 'x' : 'check'}
                              size={20}
                              color={isCancelled ? '#DC2626' : '#158263'}
                            />
                          </View>

                          <View
                            style={[
                              styles.pastStatusPill,
                              isCancelled && { backgroundColor: '#FEF2F2' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.pastStatusText,
                                isCancelled && { color: '#DC2626' },
                              ]}
                            >
                              {statusText}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.pastTitle} numberOfLines={2}>
                          {visit.title} · {visit.shortDate || visit.date}
                        </Text>

                        <Text style={styles.pastSubtitle} numberOfLines={1}>
                          {visit.beneficiaryName ? `${visit.beneficiaryName} · ` : ''}
                          with {companionShort}
                        </Text>

                        <View style={styles.pastFooterLink}>
                          <Text style={styles.pastFooterText}>Read companion report</Text>
                          <Feather name="arrow-right" size={16} color="#FE6700" />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconBox}>
                    <Feather name="clock" size={22} color="#FE6700" />
                  </View>
                  <Text style={styles.emptyTitle}>No past visits logged yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Completed visit summaries, vitals, and companion reports will appear here.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Upcoming Visit Details & Change Request Action Modal */}
      <Modal
        visible={!!selectedUpcomingVisit}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedUpcomingVisit(null)}
      >
        <View style={styles.detailModalOverlay}>
          <TouchableOpacity
            style={{ flex: 1, width: '100%' }}
            activeOpacity={1}
            onPress={() => setSelectedUpcomingVisit(null)}
          />
          {selectedUpcomingVisit && (
            <View
              style={[
                styles.detailModalSheet,
                { paddingBottom: Math.max(24, insets.bottom + 16) },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.modalTitle}>{selectedUpcomingVisit.title}</Text>
                  <Text style={styles.detailModalSub}>
                    {selectedUpcomingVisit.date} · {selectedUpcomingVisit.timeRange || selectedUpcomingVisit.time}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.detailCloseBtn}
                  onPress={() => setSelectedUpcomingVisit(null)}
                >
                  <Feather name="x" size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <View style={styles.detailInfoCard}>
                <View style={styles.detailRow}>
                  <Feather name="user" size={16} color="#667085" />
                  <Text style={styles.detailRowText}>
                    Saathi: {selectedUpcomingVisit.companionName}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Feather name="clock" size={16} color="#667085" />
                  <Text style={styles.detailRowText}>
                    Duration: {selectedUpcomingVisit.duration}
                  </Text>
                </View>
                {selectedUpcomingVisit.location && (
                  <View style={styles.detailRow}>
                    <Feather name="map-pin" size={16} color="#667085" />
                    <Text style={styles.detailRowText}>{selectedUpcomingVisit.location}</Text>
                  </View>
                )}
              </View>

              {selectedUpcomingVisit.changeRequestStatus === 'rejected' && (
                <View style={styles.rejectionAlert}>
                  <Feather name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rejectionTitle}>Change Request Declined</Text>
                    <Text style={styles.rejectionReason}>
                      "{selectedUpcomingVisit.changeResolutionReason || 'Care team could not accommodate the requested slot.'}"
                    </Text>
                  </View>
                </View>
              )}

              {selectedUpcomingVisit.changeRequestStatus === 'approved' ? (
                <View style={styles.acceptedAlert}>
                  <Feather name="check-circle" size={16} color="#059669" style={{ marginRight: 8 }} />
                  <Text style={styles.acceptedText}>Change Request Approved</Text>
                </View>
              ) : selectedUpcomingVisit.changeRequestStatus === 'pending' &&
                selectedUpcomingVisit.changeRequestedAt ? (
                <View style={styles.requestButtonDisabled}>
                  <Feather name="clock" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
                  <Text style={styles.requestButtonTextDisabled}>Change Request Pending</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.requestButton}
                  activeOpacity={0.8}
                  onPress={() => handleRequestChangePress(selectedUpcomingVisit)}
                >
                  <Text style={styles.requestButtonText}>Request Schedule Change</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Modal>

      {/* Request Change Form Modal */}
      <Modal
        visible={isChangeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChangeModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Change</Text>
              <TouchableOpacity onPress={() => setChangeModalVisible(false)}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Provide your preferred date, time, and reason. Requests must be made at least 48 hours before the scheduled visit.
            </Text>

            <Text style={styles.inputLabel}>Preferred Date</Text>
            {Platform.OS === 'web' ? (
              <TextInput
                style={styles.textInput}
                value={preferredDate}
                onChangeText={setPreferredDate}
                placeholder="e.g., Oct 20, 2026"
                placeholderTextColor="#9CA3AF"
                {...({ type: 'date' } as any)}
              />
            ) : (
              <TouchableOpacity
                style={[styles.textInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setDatePickerVisibility(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: preferredDate ? '#111827' : '#9CA3AF', fontSize: 15, fontFamily: 'Poppins-Regular' }}>
                  {preferredDate || 'Select preferred date'}
                </Text>
                <Feather name="calendar" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            <Text style={styles.inputLabel}>Preferred Time</Text>
            {Platform.OS === 'web' ? (
              <TextInput
                style={styles.textInput}
                value={preferredTime}
                onChangeText={setPreferredTime}
                placeholder="e.g., 10:00 AM"
                placeholderTextColor="#9CA3AF"
                {...({ type: 'time' } as any)}
              />
            ) : (
              <TouchableOpacity
                style={[styles.textInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setTimePickerVisibility(true)}
                activeOpacity={0.7}
              >
                <Text style={{ color: preferredTime ? '#111827' : '#9CA3AF', fontSize: 15, fontFamily: 'Poppins-Regular' }}>
                  {preferredTime || 'Select preferred time'}
                </Text>
                <Feather name="clock" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            <Text style={styles.inputLabel}>Reason for Change</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={changeReason}
              onChangeText={setChangeReason}
              placeholder="Briefly explain why you need to reschedule..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={styles.submitModalButton}
              onPress={submitChangeRequest}
              disabled={submittingChange}
            >
              {submittingChange ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitModalText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirmDate}
          onCancel={() => setDatePickerVisibility(false)}
        />
        <DateTimePickerModal
          isVisible={isTimePickerVisible}
          mode="time"
          onConfirm={handleConfirmTime}
          onCancel={() => setTimePickerVisibility(false)}
        />
      </Modal>

      {/* Past Visit Companion Report Modal */}
      <CompanionVisitReportModal
        visible={!!selectedReportVisit}
        visit={selectedReportVisit}
        onClose={() => setSelectedReportVisit(null)}
      />

      {/* SOS Emergency Assistance Modal */}
      <EmergencyAssistanceModal
        visible={showEmergencyModal}
        loading={triggeringSos}
        onCancel={() => setShowEmergencyModal(false)}
        onConfirmCall={executeSosCall}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF3EB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  titleBlock: {
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.56,
    textTransform: 'uppercase',
    color: '#FE6700',
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 21,
    lineHeight: 32,
    letterSpacing: -0.525,
    color: '#1F2937',
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    backgroundColor: '#EFE5DD',
    borderRadius: 16,
    marginBottom: 24,
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: '#667085',
  },
  tabTextActive: {
    color: '#202733',
  },
  tabBody: {
    gap: 24,
  },
  laterSection: {
    marginTop: 4,
  },
  laterHeading: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 27,
    color: '#1F2937',
    marginBottom: 12,
  },
  laterList: {
    gap: 12,
  },
  laterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.08,
    borderColor: '#E7DED6',
    borderRadius: 24,
  },
  dateBadge: {
    minWidth: 48,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FFF3D2',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeDay: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 11,
    lineHeight: 16,
    textTransform: 'uppercase',
    color: '#8B5A00',
  },
  dateBadgeNum: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 28,
    color: '#8B5A00',
  },
  laterInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  laterTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#1F2937',
  },
  laterSub: {
    marginTop: 4,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: '#667085',
  },
  pastList: {
    gap: 16,
  },
  pastCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.08,
    borderColor: '#E7DED6',
    borderRadius: 24,
    padding: 20,
  },
  pastTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pastIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#E8F7F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pastStatusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: '#E8F7F1',
  },
  pastStatusText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    color: '#158263',
  },
  pastTitle: {
    marginTop: 20,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#1F2937',
  },
  pastSubtitle: {
    marginTop: 4,
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#667085',
  },
  pastFooterLink: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pastFooterText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: '#FE6700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.08,
    borderColor: '#E7DED6',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF0E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: '#667085',
    textAlign: 'center',
    maxWidth: 280,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loaderText: {
    fontSize: 15,
    color: '#667085',
    fontFamily: 'Poppins-Medium',
    marginTop: 12,
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 18,
    color: '#1F2937',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 6,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#FE6700',
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  guestContent: {
    flexGrow: 1,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 24,
    justifyContent: 'center',
  },
  guestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.08,
    borderColor: '#E7DED6',
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0E6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
  },
  guestBadgeText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#FE6700',
  },
  guestIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  guestDesc: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#667085',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  guestPrimaryBtn: {
    width: '100%',
    backgroundColor: '#FE6700',
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  guestPrimaryBtnText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
  },
  guestSecondaryBtn: {
    marginTop: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  guestSecondaryBtnText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#667085',
  },
  guestSecondaryLink: {
    fontFamily: 'Poppins-SemiBold',
    color: '#FE6700',
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  detailModalSheet: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  detailModalSub: {
    marginTop: 4,
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#667085',
  },
  detailCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F1EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailInfoCard: {
    backgroundColor: '#FAF3EB',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailRowText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#1F2937',
  },
  requestButton: {
    backgroundColor: '#FE6700',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
  },
  requestButtonDisabled: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  requestButtonTextDisabled: {
    color: '#9CA3AF',
    fontSize: 15,
    fontFamily: 'Poppins-Medium',
  },
  rejectionAlert: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rejectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: '#DC2626',
    marginBottom: 2,
  },
  rejectionReason: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#991B1B',
    fontStyle: 'italic',
  },
  acceptedAlert: {
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptedText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: '#059669',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    color: '#1F2937',
    fontFamily: 'Poppins-SemiBold',
  },
  modalDescription: {
    fontSize: 14,
    color: '#667085',
    fontFamily: 'Poppins-Regular',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    color: '#374151',
    fontFamily: 'Poppins-Medium',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    fontFamily: 'Poppins-Regular',
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitModalButton: {
    backgroundColor: '#FE6700',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitModalText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
  },
});
