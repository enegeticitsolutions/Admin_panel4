import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  Image,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '@/constants/api';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { SathiBottomNav } from '@/components/shared/SathiBottomNav';
import { useExitOnBack } from '@/hooks/useExitOnBack';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import DateTimePickerModal from "react-native-modal-datetime-picker";


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => Math.round((SCREEN_WIDTH / 390) * size);

const DEEP_ORANGE = '#FE6700';

export default function SathiDashboard() {
  useExitOnBack();
  const insets = useSafeAreaInsets();
  const { push, replace } = useNavigationStack();
  useAndroidBackHandler();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Edit Profile States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    age: '',
    gender: '',
    previousExperience: '',
    whyJoin: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(false);

  // Modal states
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAllUpcomingVisits, setShowAllUpcomingVisits] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [successMessage, setSuccessMessage] = useState<{title: string, message: string} | null>(null);

  // OTP Verification States
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpRequestId, setOtpRequestId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Feedback States
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRequestId, setFeedbackRequestId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Active Visit Timer State
  const [activeVisitElapsedTime, setActiveVisitElapsedTime] = useState('00:00:00');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (dashboard?.activeVisit && dashboard.activeVisit.checkInTime) {
      interval = setInterval(() => {
        const start = new Date(dashboard.activeVisit.checkInTime).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, now - start);

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        
        setActiveVisitElapsedTime(
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        );
      }, 1000);
    } else {
      setActiveVisitElapsedTime('00:00:00');
    }
    return () => clearInterval(interval);
  }, [dashboard?.activeVisit]);


  const handleOpenEdit = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setFetchingProfile(true);
      setShowEditModal(true);

      const response = await fetch(`${API_URL}/sathi/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Could not fetch profile');
      const res = await response.json();
      const profile = res.data || res;

      setEditForm({
        name: profile.name || '',
        email: profile.email || '',
        age: profile.age ? String(profile.age) : '',
        gender: profile.gender || '',
        previousExperience: profile.previousExperience || '',
        whyJoin: profile.whyJoin || '',
      });
    } catch (error) {
      Alert.alert('Error', 'Could not fetch profile details.');
      setShowEditModal(false);
    } finally {
      setFetchingProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('Validation Error', 'Full name is required.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setSavingProfile(true);
      const response = await fetch(`${API_URL}/sathi/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email || null,
          age: editForm.age ? parseInt(editForm.age, 10) : null,
          gender: editForm.gender || null,
          previousExperience: editForm.previousExperience,
          whyJoin: editForm.whyJoin,
        }),
      });

      const res = await response.json();
      if (response.ok || res.success) {
        Alert.alert('Success', 'Profile updated successfully.');
        setShowEditModal(false);
        fetchDashboardData();
      } else {
        Alert.alert('Error', res.message || 'Failed to update profile.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to the backend server.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Sathi Care Support',
      'Need assistance with companion verification or visit coordination?\n\n✉️ Email: info@maihoonna.com\n⏱️ Hours: Mon–Sat, 9:00 AM – 7:00 PM IST\n📍 Service Hub: Gurugram, Haryana, India',
      [
        {
          text: 'Send Email',
          onPress: () => {
            Linking.openURL('mailto:info@maihoonna.com?subject=Sathi%20Network%20Verification%20Support').catch(() => {
              Alert.alert('Support Email', 'Please email us directly at:\ninfo@maihoonna.com');
            });
          }
        },
        { text: 'Close', style: 'cancel' }
      ]
    );
  };

  const fetchDashboardData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/sathi/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }
      if (!response.ok) throw new Error('Dashboard data error');
      const data = await response.json();
      setDashboard(data.data || data);
      setError(null);
    } catch (error) {
      console.log('Error fetching dashboard:', error);
      setError('Unable to load dashboard. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Handle reapply action for rejected volunteers
  const handleReapply = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setLoading(true);
      const response = await fetch(`${API_URL}/sathi/auth/reapply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (response.ok || data.success) {
        Alert.alert('Re-applied Successfully', 'Your profile is now under review again.');
        fetchDashboardData();
      } else {
        Alert.alert('Action Failed', data.message || 'Could not process re-application.');
        setLoading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to the backend server.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      replace('/(auth)');
    } catch (error) {
      console.error(error);
    }
  };

  const handleRespondRequest = async (requestId: string, action: 'ACCEPT') => {
    try {
      Alert.alert(
        'Accept Request',
        'Are you sure you want to accept this companion visit request?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Accept',
            onPress: async () => {
              await submitResponse(requestId, action);
            }
          }
        ]
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to process request action.');
    }
  };



  const submitResponse = async (requestId: string, action: 'ACCEPT' | 'REJECT', reason?: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setLoading(true);
      const response = await fetch(`${API_URL}/sathi/visit-requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          rejectionReason: reason || null,
        }),
      });

      const data = await response.json();
      if (response.ok || data.success) {
        Alert.alert('Success', action === 'ACCEPT' ? 'Visit request accepted!' : 'Visit request rejected.');
        fetchDashboardData();
      } else {
        Alert.alert('Failed', data.message || 'Could not process request response.');
        setLoading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to the backend server.');
      setLoading(false);
    }
  };

  const handleStartVisit = async (beneficiaryId: string, assignmentId: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setLoading(true);
      const response = await fetch(`${API_URL}/sathi/visits/checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          beneficiaryId,
          assignmentId,
        }),
      });

      const data = await response.json();
      if (response.ok || data.success) {
        Alert.alert('Success', 'Visit started successfully!');
        setLoading(false);
        replace('/(sathi)/hours');
      } else {
        Alert.alert('Failed', data.message || 'Could not start visit.');
        setLoading(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to the backend server.');
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpInput || otpInput.length !== 4) {
      Alert.alert('Error', 'Please enter a valid 4-digit PIN.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setVerifyingOtp(true);
      const response = await fetch(`${API_URL}/sathi/visit-requests/${otpRequestId}/verify-otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          otpCode: otpInput,
        }),
      });

      const data = await response.json();
      if (response.ok || data.success) {
        Alert.alert('Success', 'PIN Verified! Visit is now in progress.');
        setShowOtpModal(false);
        setOtpInput('');
        fetchDashboardData();
        replace('/(sathi)/hours');
      } else {
        Alert.alert('Verification Failed', data.message || 'Invalid PIN.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not verify PIN. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSkipFeedback = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setSubmittingFeedback(true);
      // We can just call the same feedback endpoint with a 0 rating and empty notes, 
      // or a new skip endpoint. Since the backend allows any rating and notes,
      // we just submit dummy feedback to mark it complete.
      const response = await fetch(`${API_URL}/sathi/visit-requests/${feedbackRequestId}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedbackNotes: 'No feedback provided.',
          feedbackRating: 0,
        }),
      });

      const data = await response.json();
      if (response.ok || data.success) {
        setShowFeedbackModal(false);
        setFeedbackNotes('');
        setFeedbackRating(5);
        fetchDashboardData();
      } else {
        Alert.alert('Failed', data.message || 'Could not skip feedback.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not skip feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackNotes.trim()) {
      Alert.alert('Validation Error', 'Please enter some notes for this visit.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setSubmittingFeedback(true);
      const response = await fetch(`${API_URL}/sathi/visit-requests/${feedbackRequestId}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedbackNotes,
          feedbackRating,
        }),
      });

      const data = await response.json();
      if (response.ok || data.success) {
        Alert.alert('Success', 'Feedback submitted successfully.');
        setShowFeedbackModal(false);
        setFeedbackNotes('');
        setFeedbackRating(5);
        fetchDashboardData();
      } else {
        Alert.alert('Failed', data.message || 'Could not submit feedback.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (e) {
      console.log('Error fetching unread count:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
      fetchUnreadCount();
      const pollTimer = setInterval(() => {
        fetchDashboardData();
        fetchUnreadCount();
      }, 30000);

      return () => clearInterval(pollTimer);
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={DEEP_ORANGE} />
        <Text style={styles.loaderText}>Loading Saathi Dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="wifi-off" size={scale(64)} color="#D1D5DB" />
        <Text style={{ marginTop: scale(16), fontSize: scale(16), color: '#4B5563', textAlign: 'center', paddingHorizontal: scale(32) }}>
          {error}
        </Text>
        <TouchableOpacity 
          style={{ marginTop: scale(24), backgroundColor: DEEP_ORANGE, paddingHorizontal: scale(24), paddingVertical: scale(12), borderRadius: scale(8) }}
          onPress={() => { setLoading(true); fetchDashboardData(); }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: scale(16) }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Verification Pending & Rejected Onboarding views ────────────────────────
  // ─── Verification Pending & Rejected Onboarding views ────────────────────────
  const appStatus = dashboard?.applicationStatus;

  // Only gate on status once dashboard is loaded — avoids showing pending screen on logout/initial load
  if (dashboard && appStatus && appStatus !== 'APPROVED') {
    const isRejected = appStatus === 'REJECTED';
    const isSuspended = appStatus === 'SUSPENDED';
    const isNotApplied = appStatus === 'NOT_APPLIED';

    // Calculate if re-apply cooldown is active
    let reapplyActive = false;
    let daysRemaining = 0;
    if (dashboard?.reapplyAllowedAfter) {
      const allowedDate = new Date(dashboard.reapplyAllowedAfter);
      const today = new Date();
      if (today < allowedDate) {
        reapplyActive = true;
        const diffTime = allowedDate.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 40 : 20) }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.pendingHeader}>
            <Text style={styles.brandTitle}>Saathi Network</Text>
          </View>

          {isRejected ? (
            <View style={styles.pendingCard}>
              <MaterialCommunityIcons name="account-cancel" size={scale(70)} color="#EF4444" />
              <Text style={[styles.pendingTitle, { color: '#EF4444' }]}>Verification Failed</Text>
              
              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Reason:</Text>
                  <Text style={[styles.infoValue, { color: '#EF4444' }]}>{dashboard?.rejectionReason || 'No specific reason provided.'}</Text>
                </View>
              </View>

              <Text style={styles.pendingDesc}>
                We are sorry, but your application for Saathi companion volunteer could not be approved.
              </Text>

              {reapplyActive ? (
                <View style={styles.cooldownContainer}>
                  <Text style={styles.cooldownText}>
                    You can re-apply on {new Date(dashboard.reapplyAllowedAfter).toLocaleDateString()} ({daysRemaining} days remaining).
                  </Text>
                  <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: '#D1D5DB' }]} disabled={true}>
                    <Text style={styles.refreshBtnText}>Re-application Locked</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: '#EF4444' }]} onPress={handleReapply}>
                  <Text style={styles.refreshBtnText}>Re-apply for Volunteer</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : isSuspended ? (
            <View style={styles.pendingCard}>
              <MaterialCommunityIcons name="account-off" size={scale(70)} color="#EF4444" />
              <Text style={[styles.pendingTitle, { color: '#EF4444' }]}>Account Suspended</Text>
              <Text style={styles.pendingDesc}>
                Your volunteer profile has been temporarily suspended. Please contact operations support to resolve this issue.
              </Text>
            </View>
          ) : isNotApplied ? (
            <View style={styles.pendingCard}>
              <MaterialCommunityIcons name="account-plus-outline" size={scale(70)} color="#FF7A00" />
              <Text style={styles.pendingTitle}>Welcome to Saathi Network!</Text>
              <Text style={styles.pendingDesc}>
                Earn credits on an hourly basis by volunteering as a companion for seniors.
              </Text>
              <Text style={styles.pendingDescSec}>
                Complete your companion application details to unlock senior match lists and schedule check-ins.
              </Text>

              <TouchableOpacity style={styles.refreshBtn} onPress={() => replace('/(sathi)/apply')}>
                <Text style={styles.refreshBtnText}>Start Saathi Application</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Verification Pending View
            <View style={styles.pendingCard}>
              <MaterialCommunityIcons name="account-clock" size={scale(70)} color="#FF7A00" />
              <Text style={styles.pendingTitle}>Verification Pending</Text>
              <Text style={styles.pendingDesc}>
                Your profile has been submitted successfully.
              </Text>

              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Status:</Text>
                  <Text style={[styles.infoValue, { color: '#FF7A00', fontWeight: '800' }]}>
                    {appStatus === 'UNDER_REVIEW' ? 'Under Review' : appStatus === 'SUBMITTED' ? 'Submitted' : 'Pending'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Estimated Time:</Text>
                  <Text style={styles.infoValue}>24–48 hours</Text>
                </View>
              </View>

              <Text style={styles.pendingDescSec}>
                You will receive a notification once your profile is approved.
              </Text>

              <TouchableOpacity style={styles.refreshBtn} onPress={fetchDashboardData}>
                <Text style={styles.refreshBtnText}>Check Review Status</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Action Buttons for Verification Pending screen */}
          <View style={styles.pendingActions}>
            {!isSuspended && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleOpenEdit}>
                <Ionicons name="create-outline" size={18} color="#111827" />
                <Text style={styles.actionBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.actionBtn} onPress={handleContactSupport}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#111827" />
              <Text style={styles.actionBtnText}>Contact Support</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={[styles.logoutBtnText, { color: '#EF4444' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
          
          {/* Edit Profile Modal */}
          <Modal
            visible={showEditModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowEditModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Profile Info</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Ionicons name="close" size={24} color="#111827" />
                  </TouchableOpacity>
                </View>

                {fetchingProfile ? (
                  <ActivityIndicator size="large" color="#FF7A00" style={{ padding: 40 }} />
                ) : (
                  <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Full Name</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editForm.name}
                        onChangeText={(t) => setEditForm(prev => ({ ...prev, name: t }))}
                        placeholder="Enter full name"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Email Address</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editForm.email}
                        onChangeText={(t) => setEditForm(prev => ({ ...prev, email: t }))}
                        placeholder="Enter email address"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Age</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editForm.age}
                        onChangeText={(t) => setEditForm(prev => ({ ...prev, age: t.replace(/\D/g, '') }))}
                        placeholder="Enter age"
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Gender</Text>
                      <TextInput
                        style={styles.textInput}
                        value={editForm.gender}
                        onChangeText={(t) => setEditForm(prev => ({ ...prev, gender: t }))}
                        placeholder="e.g. Male, Female, Other"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Past Volunteer Experience</Text>
                      <TextInput
                        style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                        value={editForm.previousExperience}
                        onChangeText={(t) => setEditForm(prev => ({ ...prev, previousExperience: t }))}
                        placeholder="Detail any previous volunteering experience..."
                        multiline={true}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Why do you want to join?</Text>
                      <TextInput
                        style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                        value={editForm.whyJoin}
                        onChangeText={(t) => setEditForm(prev => ({ ...prev, whyJoin: t }))}
                        placeholder="Tell us why you want to become a Saathi..."
                        multiline={true}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.saveBtn, savingProfile && { opacity: 0.7 }]}
                      onPress={handleSaveProfile}
                      disabled={savingProfile}
                    >
                      {savingProfile ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.saveBtnText}>Save Changes</Text>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
        </ScrollView>
    </View>
    );
  }

  // ─── Dashboard view (Verified volunteer) ───────────────────────────────────
  const goalProgress = dashboard
    ? Math.min((dashboard.totalCreditHours / dashboard.monthlyGoalHours) * 100, 100)
    : 0;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 40 : 20) }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Welcome back, {dashboard?.name || 'Saathi'}!</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: scale(4) }}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.locationText}>
                {[dashboard?.city, dashboard?.state].filter(Boolean).join(', ') || 'Location pending'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationBell} onPress={() => router.push('/(sathi)/notifications')}>
            <Ionicons name="notifications-outline" size={24} color="#111827" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Additional Stats Grid (from DB) */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#EAF2FF' }]}>
              <Ionicons name="time-outline" size={22} color="#4B93FF" />
            </View>
            <View>
              <Text style={styles.statVal}>{(dashboard?.totalCreditHours || 0).toFixed(1)}</Text>
              <Text style={styles.statLbl}>Total Hours</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#E6F7F1' }]}>
              <Ionicons name="people-outline" size={22} color="#1FB474" />
            </View>
            <View>
              <Text style={styles.statVal}>{dashboard?.beneficiariesCount || 0}</Text>
              <Text style={styles.statLbl}>Beneficiaries</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#E6F7F1' }]}>
              <Ionicons name="checkmark-done-outline" size={22} color="#1FB474" />
            </View>
            <View>
              <Text style={styles.statVal}>{dashboard?.totalVisits || 0}</Text>
              <Text style={styles.statLbl}>Total Visits</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#EAF2FF' }]}>
              <Ionicons name="time-outline" size={22} color="#4B93FF" />
            </View>
            <View>
              <Text style={styles.statVal}>{dashboard?.hoursThisMonth?.toFixed(1) || '0.0'}</Text>
              <Text style={styles.statLbl}>Hours This Month</Text>
            </View>
          </View>
        </View>

        {/* Companion Rewards & Credits Banner */}
        <TouchableOpacity
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: scale(16),
            padding: scale(16),
            marginBottom: scale(16),
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#FFE3D1',
            shadowColor: '#FE6700',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
          onPress={() => router.push('/(sathi)/credits')}
        >
          <View style={{ width: scale(44), height: scale(44), borderRadius: scale(12), backgroundColor: '#FFF5ED', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFE3D1' }}>
            <Ionicons name="gift-outline" size={24} color="#FF6F00" />
          </View>
          <View style={{ flex: 1, marginLeft: scale(12) }}>
            <Text style={{ color: '#111827', fontWeight: '700', fontSize: scale(15) }}>Companion Rewards</Text>
            <Text style={{ color: '#4B5563', fontSize: scale(12), marginTop: scale(2) }}>
              {dashboard?.totalCreditPoints !== undefined ? `${dashboard.totalCreditPoints.toFixed(0)} Credits Available` : 'Earn & redeem vouchers'}
            </Text>
          </View>
          <View style={{ paddingHorizontal: scale(12), paddingVertical: scale(6), borderRadius: scale(12), borderWidth: 1, borderColor: '#FF6F00' }}>
            <Text style={{ color: '#FF6F00', fontWeight: '700', fontSize: scale(12) }}>Redeem</Text>
          </View>
        </TouchableOpacity>


        {/* Upcoming Visits */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={scale(20)} color="#FF6F00" style={{ marginRight: scale(8) }} />
            <Text style={styles.sectionTitle}>Upcoming Visits</Text>
          </View>
          {dashboard?.upcomingVisits?.length > 1 && (
            <TouchableOpacity 
              style={{ paddingHorizontal: scale(12), paddingVertical: scale(4), borderRadius: scale(20), borderWidth: 1, borderColor: '#FF6F00' }}
              onPress={() => setShowAllUpcomingVisits(!showAllUpcomingVisits)}
            >
              <Text style={{ color: '#FF6F00', fontSize: scale(12), fontFamily: 'Poppins-SemiBold' }}>
                {showAllUpcomingVisits ? 'View Less' : 'View All'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {dashboard?.upcomingVisits && dashboard.upcomingVisits.length > 0 ? (
          [...dashboard.upcomingVisits].sort((a: any, b: any) => {
            const timeA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
            const timeB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
            return Math.abs(timeA - currentTime.getTime()) - Math.abs(timeB - currentTime.getTime());
          }).slice(0, showAllUpcomingVisits ? dashboard.upcomingVisits.length : 1).map((item: any) => {
            let formattedDate = '';
            let formattedTime = '';
            let countdownText = '';
            let isWithin30Mins = true;

            if (item.dateTime) {
              const d = new Date(item.dateTime);
              formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
              formattedTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

              const timeDiff = d.getTime() - currentTime.getTime();
              const thirtyMins = 30 * 60 * 1000;
              isWithin30Mins = timeDiff <= thirtyMins;
              
              if (!isWithin30Mins && timeDiff > 0) {
                const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeDiff / (1000 * 60 * 60)) % 24);
                const mins = Math.floor((timeDiff / 1000 / 60) % 60);
                
                let parts = [];
                if (days > 0) parts.push(`${days}d`);
                if (hours > 0) parts.push(`${hours}h`);
                if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
                countdownText = `Starts in ${parts.join(' ')}`;
              }
            }

            return (
              <View key={item.id} style={[styles.requestCard, { padding: scale(16), marginBottom: scale(16) }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Image source={{ uri: sanitizeImageUri(item.photo) }} style={{ width: scale(56), height: scale(56), borderRadius: scale(16), marginRight: scale(14) }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: scale(16), color: '#111827', fontFamily: 'Poppins-SemiBold', marginBottom: scale(4) }}>
                      {item.name}{item.age ? `, ${item.age}` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="location-outline" size={14} color="#6B7280" />
                      <Text style={{ fontSize: scale(13), color: '#6B7280', fontFamily: 'Poppins-Regular', marginLeft: scale(4) }}>{item.location || 'Delhi'}</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#4B93FF', paddingHorizontal: scale(8), paddingVertical: scale(2), borderRadius: scale(12) }}>
                    <Text style={{ fontSize: scale(11), color: '#4B93FF', fontFamily: 'Poppins-Medium' }}>{item.distance || '1.2 km'}</Text>
                  </View>
                </View>

                {/* Gap/Spacing */}
                <View style={{ height: scale(24) }} />

                {/* Bottom Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: scale(13), color: '#4B5563', fontFamily: 'Poppins-Medium' }}>{formattedDate}</Text>
                  <Text style={{ fontSize: scale(13), color: '#6B7280', fontFamily: 'Poppins-Medium' }}>{item.visitCount || 0} visits</Text>
                </View>

                {/* Start Visit Button OR Countdown OR IN PROGRESS */}
                {item.status === 'IN_PROGRESS' ? (
                  <View style={{ marginTop: scale(20) }}>
                    <TouchableOpacity
                      style={{ backgroundColor: '#DBEAFE', paddingVertical: scale(12), borderRadius: scale(20), flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#93C5FD' }}
                      onPress={() => replace('/(sathi)/hours')}
                    >
                      <Ionicons name="time" size={18} color="#1E40AF" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#1E40AF', fontFamily: 'Poppins-SemiBold', fontSize: scale(14) }}>
                        {activeVisitElapsedTime}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : !isWithin30Mins && countdownText ? (
                  <View style={{ marginTop: scale(20), backgroundColor: '#F3F4F6', paddingVertical: scale(12), borderRadius: scale(20), flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={18} color="#9CA3AF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#6B7280', fontFamily: 'Poppins-SemiBold', fontSize: scale(14) }}>{countdownText}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={{ marginTop: scale(20), backgroundColor: '#FF6F00', paddingVertical: scale(12), borderRadius: scale(20), flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => {
                      if (dashboard?.activeVisit) {
                        Alert.alert('Action Denied', 'You already have an active visit in progress. Please check out of your current visit before starting a new one.');
                        return;
                      }
                      setOtpRequestId(item.id);
                      setShowOtpModal(true);
                    }}
                  >
                    <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFFFFF', fontFamily: 'Poppins-SemiBold', fontSize: scale(14) }}>Start Visit</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No upcoming companion visits scheduled.</Text>
        )}

        {/* Visit Requests */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="people-outline" size={scale(20)} color="#FF6F00" style={{ marginRight: scale(8) }} />
            <Text style={styles.sectionTitle}>Visit Requests</Text>
          </View>
          <TouchableOpacity style={{ paddingHorizontal: scale(12), paddingVertical: scale(4), borderRadius: scale(20), borderWidth: 1, borderColor: '#FF6F00' }}>
            <Text style={{ color: '#FF6F00', fontSize: scale(12), fontFamily: 'Poppins-SemiBold' }}>View All</Text>
          </TouchableOpacity>
        </View>

        {dashboard?.visitRequests && dashboard.visitRequests.length > 0 ? (
          dashboard.visitRequests.map((item: any) => {
            let formattedDate = '';
            let formattedTime = '';
            if (item.dateTime) {
              const d = new Date(item.dateTime);
              formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
              formattedTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            }

            return (
              <View key={item.id} style={[styles.requestCard, { padding: scale(16), marginBottom: scale(16) }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: scale(16) }}>
                  <Image source={{ uri: sanitizeImageUri(item.photo) }} style={{ width: scale(56), height: scale(56), borderRadius: scale(16), marginRight: scale(14) }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: scale(16), color: '#111827', fontFamily: 'Poppins-SemiBold', marginBottom: scale(4) }}>
                      {item.name}{item.age ? `, ${item.age}` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="location-outline" size={14} color="#6B7280" />
                      <Text style={{ fontSize: scale(13), color: '#6B7280', fontFamily: 'Poppins-Regular', marginLeft: scale(4) }}>{item.location || 'Delhi'}</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: '#EAF2FF', borderWidth: 1, borderColor: '#4B93FF', paddingHorizontal: scale(8), paddingVertical: scale(2), borderRadius: scale(12) }}>
                    <Text style={{ fontSize: scale(11), color: '#4B93FF', fontFamily: 'Poppins-Medium' }}>{item.distance || '1.2 km'}</Text>
                  </View>
                </View>

                {item.bio ? <Text style={{ fontSize: scale(14), color: '#374151', lineHeight: scale(20), marginBottom: scale(16), fontFamily: 'Poppins-Regular' }}>{item.bio}</Text> : <View style={{ height: scale(8) }} />}

                {/* Hobbies / Interests Tags */}
                {item.hobbies && item.hobbies.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), marginBottom: scale(16) }}>
                    {item.hobbies.map((tag: string) => (
                      <View key={tag} style={{ backgroundColor: '#F3E8FF', paddingHorizontal: scale(12), paddingVertical: scale(6), borderRadius: scale(16) }}>
                        <Text style={{ color: '#9333EA', fontSize: scale(12), fontFamily: 'Poppins-Medium' }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Date Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(20) }}>
                  <Text style={{ fontSize: scale(13), color: '#4B5563', fontFamily: 'Poppins-Medium' }}>{item.totalVisits || 0} total visits</Text>
                  <Text style={{ fontSize: scale(13), color: '#6B7280', fontFamily: 'Poppins-Medium' }}>Last: {item.lastVisit || 'N/A'}</Text>
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: scale(12) }}>
                  <TouchableOpacity 
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF6F00', paddingVertical: scale(12), borderRadius: scale(20) }}
                    onPress={() => {
                      setSelectedRequest(item);
                      setShowConfirmModal(true);
                    }}
                  >
                    <Ionicons name="heart-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFFFFF', fontFamily: 'Poppins-SemiBold', fontSize: scale(14) }}>Accept</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4ED', borderWidth: 1, borderColor: '#FF6F00', paddingVertical: scale(12), borderRadius: scale(20) }}
                    onPress={() => {
                      setSelectedRequest(item);
                      setShowRescheduleModal(true);
                    }}
                  >
                    <Ionicons name="refresh-outline" size={16} color="#FF6F00" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FF6F00', fontFamily: 'Poppins-SemiBold', fontSize: scale(14) }}>Reschedule</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No pending visit requests.</Text>
        )}

        {/* Log Hours floating/bottom button */}
        <TouchableOpacity style={styles.logHoursBtn} onPress={() => replace('/(sathi)/hours')}>
          <Ionicons name="time-outline" size={16} color="#FF6F00" style={{ marginRight: scale(8) }} />
          <Text style={styles.logHoursBtnText}>Log Hours</Text>
        </TouchableOpacity>
      </ScrollView>

      <SathiBottomNav />

      {/* Confirm Visit Modal */}
      {showConfirmModal && selectedRequest && (
        <ConfirmVisitModal
          visible={showConfirmModal}
          request={selectedRequest}
          onClose={() => setShowConfirmModal(false)}
          onSuccess={() => {
            setShowConfirmModal(false);
            fetchDashboardData();
          }}
          onShowSuccess={(title, msg) => setSuccessMessage({title, message: msg})}
        />
      )}

      {/* Reschedule Proposal Modal */}
      {showRescheduleModal && selectedRequest && (
        <RescheduleModal
          visible={showRescheduleModal}
          request={selectedRequest}
          onClose={() => setShowRescheduleModal(false)}
          onSuccess={() => {
            setShowRescheduleModal(false);
            fetchDashboardData();
          }}
          onShowSuccess={(title, msg) => setSuccessMessage({title, message: msg})}
        />
      )}

      {/* Success Modal */}
      <Modal visible={!!successMessage} transparent animationType="fade" onRequestClose={() => setSuccessMessage(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: scale(20) }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: scale(24), width: '100%', alignItems: 'center' }}>
            <View style={{ width: scale(64), height: scale(64), borderRadius: scale(32), backgroundColor: '#FFF0E6', justifyContent: 'center', alignItems: 'center', marginBottom: scale(16) }}>
              <Ionicons name="checkmark-circle" size={40} color="#FE6700" />
            </View>
            <Text style={{ fontSize: scale(20), fontFamily: 'Poppins-Bold', color: '#111827', marginBottom: scale(8), textAlign: 'center' }}>
              {successMessage?.title}
            </Text>
            <Text style={{ fontSize: scale(14), fontFamily: 'Poppins-Regular', color: '#4B5563', textAlign: 'center', marginBottom: scale(24) }}>
              {successMessage?.message}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#FE6700', paddingVertical: scale(14), borderRadius: scale(20), width: '100%', alignItems: 'center' }}
              onPress={() => setSuccessMessage(null)}
            >
              <Text style={{ color: '#FFFFFF', fontFamily: 'Poppins-Medium', fontSize: scale(14) }}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* OTP Verification Modal */}
      <Modal visible={showOtpModal} transparent animationType="slide" onRequestClose={() => setShowOtpModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <TouchableWithoutFeedback accessible={false}>
                <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: scale(24), paddingBottom: scale(40) }}>
            <Text style={{ fontSize: scale(18), fontFamily: 'Poppins-Bold', color: '#111827', marginBottom: scale(4) }}>Start Visit</Text>
            <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#6B7280', marginBottom: scale(24) }}>Ask the beneficiary for the 4-digit PIN displayed on their app to start the visit.</Text>

            <TextInput
              style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: scale(12), paddingHorizontal: scale(16), paddingVertical: scale(16), fontSize: scale(24), fontFamily: 'Poppins-Bold', color: '#111827', marginBottom: scale(24), backgroundColor: '#F9FAFB', textAlign: 'center', letterSpacing: 8 }}
              placeholder="----"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={4}
              value={otpInput}
              onChangeText={setOtpInput}
            />

            <View style={{ flexDirection: 'row', gap: scale(12) }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: scale(14), borderRadius: scale(12), backgroundColor: '#F3F4F6', alignItems: 'center' }}
                onPress={() => {
                  setShowOtpModal(false);
                  setOtpInput('');
                }}
              >
                <Text style={{ color: '#4B5563', fontFamily: 'Poppins-SemiBold', fontSize: scale(14) }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: scale(14), borderRadius: scale(12), backgroundColor: '#10B981', alignItems: 'center', opacity: verifyingOtp || otpInput.length !== 4 ? 0.7 : 1 }}
                onPress={handleVerifyOTP}
                disabled={verifyingOtp || otpInput.length !== 4}
              >
                {verifyingOtp ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontFamily: 'Poppins-SemiBold', fontSize: scale(14) }}>Verify PIN</Text>
                )}
              </TouchableOpacity>
            </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Feedback Modal */}
      <Modal visible={showFeedbackModal} transparent animationType="slide" onRequestClose={() => setShowFeedbackModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <TouchableWithoutFeedback accessible={false}>
                <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: scale(24), paddingBottom: scale(40) }}>
            <Text style={{ fontSize: scale(18), fontFamily: 'Poppins-Bold', color: '#111827', marginBottom: scale(4) }}>Visit Completed</Text>
            <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#6B7280', marginBottom: scale(24) }}>Please rate the visit and add some notes for your records.</Text>

            <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-SemiBold', color: '#374151', marginBottom: scale(8) }}>Rating</Text>
            <View style={{ flexDirection: 'row', gap: scale(16), marginBottom: scale(24), justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setFeedbackRating(star)}>
                  <Ionicons name={feedbackRating >= star ? "star" : "star-outline"} size={scale(36)} color={feedbackRating >= star ? "#F59E0B" : "#D1D5DB"} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-SemiBold', color: '#374151', marginBottom: scale(8) }}>Notes</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: scale(12), paddingHorizontal: scale(16), paddingVertical: scale(12), fontSize: scale(14), fontFamily: 'Poppins-Regular', color: '#111827', marginBottom: scale(28), backgroundColor: '#F9FAFB', height: scale(80), textAlignVertical: 'top' }}
              placeholder="How did the visit go? What did you do together?"
              placeholderTextColor="#9CA3AF"
              value={feedbackNotes}
              onChangeText={setFeedbackNotes}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: scale(12) }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: scale(14), borderRadius: scale(12), backgroundColor: '#F3F4F6', alignItems: 'center' }}
                onPress={() => {
                  setShowFeedbackModal(false);
                  setFeedbackNotes('');
                  setFeedbackRating(5);
                }}
              >
                <Text style={{ color: '#4B5563', fontFamily: 'Poppins-SemiBold', fontSize: scale(14) }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: scale(14), borderRadius: scale(12), backgroundColor: '#10B981', alignItems: 'center', opacity: submittingFeedback || !feedbackNotes.trim() ? 0.7 : 1 }}
                onPress={handleSubmitFeedback}
                disabled={submittingFeedback || !feedbackNotes.trim()}
              >
                {submittingFeedback ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontFamily: 'Poppins-SemiBold', fontSize: scale(14) }}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{ marginTop: scale(16), alignItems: 'center', paddingVertical: scale(8) }}
              onPress={handleSkipFeedback}
              disabled={submittingFeedback}
            >
              <Text style={{ color: '#9CA3AF', fontFamily: 'Poppins-Medium', fontSize: scale(14), textDecorationLine: 'underline' }}>Skip Feedback</Text>
            </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
}

const ConfirmVisitModal = ({ visible, request, onClose, onSuccess, onShowSuccess }: { visible: boolean, request: any, onClose: () => void, onSuccess: () => void, onShowSuccess: (title: string, msg: string) => void }) => {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!request?.id) return;
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setSubmitting(true);
      const response = await fetch(`${API_URL}/sathi/visit-requests/${request.id}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'ACCEPT' }),
      });

      const data = await response.json();
      if (response.ok || data.success) {
        onSuccess();
        onShowSuccess('Accepted!', 'You have successfully confirmed the visit.');
      } else {
        Alert.alert('Failed', data.message || 'Could not accept the request.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to the backend server.');
    } finally {
      setSubmitting(false);
    }
  };

  const beneficiaryName = request?.beneficiary?.name || request?.name || 'the beneficiary';
  const displayDate = request?.dateTime ? new Date(request.dateTime) : new Date();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: scale(20) }}>
        <View style={{ backgroundColor: '#FAF3EB', borderRadius: 24, padding: scale(24), position: 'relative' }}>
          
          <TouchableOpacity onPress={onClose} style={{ position: 'absolute', right: scale(16), top: scale(16), zIndex: 10 }}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: scale(24) }}>
            <Text style={{ fontSize: scale(18), fontFamily: 'Poppins-Bold', color: '#111827', marginBottom: scale(4) }}>Confirm Visit Time</Text>
            <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#6B7280', textAlign: 'center' }}>
              Confirm the time to meet {beneficiaryName}
            </Text>
          </View>

          <Text style={{ fontSize: scale(14), fontFamily: 'Poppins-SemiBold', color: '#111827', marginBottom: scale(8) }}>Their message</Text>
          <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#4B5563', marginBottom: scale(24), lineHeight: scale(20) }}>
            {request?.reason || request?.bio || "I would love some companionship on weekday mornings. I enjoy reading and light conversations."}
          </Text>

          <View style={{ flexDirection: 'row', gap: scale(12), marginBottom: scale(24) }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-SemiBold', color: '#111827', marginBottom: scale(8) }}>Date</Text>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: scale(12), paddingHorizontal: scale(12), paddingVertical: scale(12), flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar-outline" size={16} color="#6B7280" style={{ marginRight: scale(8) }} />
                <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#374151' }}>
                  {displayDate.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' })}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-SemiBold', color: '#111827', marginBottom: scale(8) }}>Time</Text>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: scale(12), paddingHorizontal: scale(12), paddingVertical: scale(12), flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="time-outline" size={16} color="#6B7280" style={{ marginRight: scale(8) }} />
                <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#374151' }}>
                  {displayDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: scale(12) }}>
            <TouchableOpacity
              style={{ flex: 1.2, paddingVertical: scale(14), borderRadius: scale(20), backgroundColor: '#FE6700', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', opacity: submitting ? 0.7 : 1 }}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: scale(6) }} />
                  <Text style={{ color: '#FFFFFF', fontFamily: 'Poppins-Medium', fontSize: scale(14) }}>Confirm Visit</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flex: 0.8, paddingVertical: scale(14), borderRadius: scale(20), borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}
              onPress={onClose}
            >
              <Text style={{ color: '#4B5563', fontFamily: 'Poppins-Medium', fontSize: scale(14) }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const RescheduleModal = ({ visible, request, onClose, onSuccess, onShowSuccess }: { visible: boolean, request: any, onClose: () => void, onSuccess: () => void, onShowSuccess: (title: string, msg: string) => void }) => {
  const [proposedDate, setProposedDate] = useState(new Date(new Date().setHours(10, 0, 0, 0)));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [rescheduleMessage, setRescheduleMessage] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const handleSubmitReschedule = async () => {
    if (!request?.id) return;

    const proposedISO = proposedDate.toISOString();

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setSubmittingReschedule(true);
      const response = await fetch(`${API_URL}/sathi/visit-requests/${request.id}/propose-reschedule`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proposedDateTime: proposedISO, message: rescheduleMessage }),
      });

      const data = await response.json();
      if (response.ok || data.success) {
        onSuccess();
        onShowSuccess('Sent!', 'Your reschedule proposal has been sent to the beneficiary.');
      } else {
        Alert.alert('Failed', data.message || 'Could not send reschedule proposal.');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to the backend server.');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const beneficiaryName = request?.beneficiary?.name || request?.name || 'the beneficiary';
  const displayDate = request?.dateTime ? new Date(request.dateTime) : new Date();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: scale(20) }}>
        <View style={{ backgroundColor: '#FAF3EB', borderRadius: 24, padding: scale(24), position: 'relative' }}>
          
          <TouchableOpacity onPress={onClose} style={{ position: 'absolute', right: scale(16), top: scale(16), zIndex: 10 }}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginBottom: scale(24) }}>
            <Text style={{ fontSize: scale(18), fontFamily: 'Poppins-Bold', color: '#111827', marginBottom: scale(4) }}>Ask to Reschedule</Text>
            <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#6B7280', textAlign: 'center' }}>
              Suggest a new time to {beneficiaryName}
            </Text>
          </View>

          <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#4B5563', marginBottom: scale(4) }}>Their preferred time</Text>
          <Text style={{ fontSize: scale(15), fontFamily: 'Poppins-Medium', color: '#111827', marginBottom: scale(24) }}>
            {displayDate.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' })} at {displayDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>

          <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Medium', color: '#111827', marginBottom: scale(8) }}>Suggest a new time</Text>
          <View style={{ flexDirection: 'row', gap: scale(12), marginBottom: scale(20) }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: scale(12), paddingHorizontal: scale(12), paddingVertical: scale(12) }}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#111827', textAlign: 'center' }}>
                {proposedDate.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: scale(12), paddingHorizontal: scale(12), paddingVertical: scale(12) }}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#111827', textAlign: 'center' }}>
                {proposedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: scale(13), fontFamily: 'Poppins-Medium', color: '#111827', marginBottom: scale(8) }}>Reason / Note</Text>
          <TextInput
            style={{ backgroundColor: '#FFFFFF', borderRadius: scale(12), paddingHorizontal: scale(16), paddingVertical: scale(16), fontSize: scale(13), fontFamily: 'Poppins-Regular', color: '#111827', marginBottom: scale(28), height: scale(90), textAlignVertical: 'top' }}
            placeholder="e.g. I have a prior commitment that morning, can we meet in the afternoon?"
            placeholderTextColor="#9CA3AF"
            value={rescheduleMessage}
            onChangeText={setRescheduleMessage}
            multiline
          />

          <DateTimePickerModal
            isVisible={showDatePicker || showTimePicker}
            mode={showDatePicker ? 'date' : 'time'}
            date={proposedDate}
            minimumDate={new Date()}
            buttonTextColorIOS="#FE6700"
            accentColor="#FE6700"
            onConfirm={(date) => {
              const updatedDate = new Date(proposedDate);
              if (showDatePicker) {
                updatedDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
              } else {
                updatedDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
              }
              setProposedDate(updatedDate);
              setShowDatePicker(false);
              setShowTimePicker(false);
            }}
            onCancel={() => {
              setShowDatePicker(false);
              setShowTimePicker(false);
            }}
          />

          <View style={{ flexDirection: 'row', gap: scale(12) }}>
            <TouchableOpacity
              style={{ flex: 1.2, paddingVertical: scale(14), borderRadius: scale(20), backgroundColor: '#FE6700', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', opacity: submittingReschedule ? 0.7 : 1 }}
              onPress={handleSubmitReschedule}
              disabled={submittingReschedule}
            >
              {submittingReschedule ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" style={{ marginRight: scale(6) }} />
                  <Text style={{ color: '#FFFFFF', fontFamily: 'Poppins-Medium', fontSize: scale(14) }}>Send Request</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flex: 0.8, paddingVertical: scale(14), borderRadius: scale(20), borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}
              onPress={onClose}
            >
              <Text style={{ color: '#4B5563', fontFamily: 'Poppins-Medium', fontSize: scale(14) }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF3EB',
  },
  scrollContent: {
    paddingHorizontal: scale(18),
    paddingTop: scale(16),
    paddingBottom: scale(100),
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loaderText: {
    marginTop: scale(12),
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(20),
  },
  welcomeText: {
    fontSize: scale(20),
    fontWeight: '700',
    color: '#111827',
  },
  locationText: {
    fontSize: scale(13),
    color: '#4B5563',
    marginTop: scale(2),
  },
  notificationBell: {
    padding: scale(8),
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: scale(20),
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: scale(16),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: scale(12),
  },
  statIconContainer: {
    padding: scale(8),
    borderRadius: scale(12),
  },
  statVal: {
    fontSize: scale(20),
    fontWeight: '700',
    color: '#111827',
  },
  statLbl: {
    fontSize: scale(11),
    color: '#6B7280',
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    padding: scale(18),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: scale(24),
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(4),
  },
  goalTitle: {
    fontSize: scale(15),
    fontWeight: '700',
    color: '#111827',
  },
  goalBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(12),
  },
  goalBadgeText: {
    fontSize: scale(11),
    color: '#1976D2',
    fontWeight: '600',
  },
  goalSubtitle: {
    fontSize: scale(13),
    color: '#4B5563',
    marginBottom: scale(12),
  },
  progressTrack: {
    height: scale(8),
    backgroundColor: '#FFF0E6',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF6F00',
    borderRadius: scale(4),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(12),
    marginTop: scale(8),
  },
  sectionTitle: {
    fontSize: scale(16),
    fontWeight: '700',
    color: '#111827',
  },
  viewAllLink: {
    fontSize: scale(13),
    color: '#FF6F00',
    fontWeight: '600',
  },
  visitCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: scale(14),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: scale(12),
    gap: scale(12),
  },
  seniorPhoto: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    backgroundColor: '#F3F4F6',
  },
  visitInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  rowJustify: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seniorName: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#111827',
  },
  distanceBadge: {
    backgroundColor: '#FFF5ED',
    borderWidth: 1,
    borderColor: '#FE6700',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(12),
  },
  distanceText: {
    fontSize: scale(10),
    color: '#FE6700',
    fontWeight: '600',
  },
  distanceBadgeBlue: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(12),
  },
  distanceTextBlue: {
    fontSize: scale(10),
    color: '#2196F3',
    fontWeight: '600',
  },
  locationTextSmall: {
    fontSize: scale(12),
    color: '#6B7280',
    marginVertical: scale(4),
  },
  visitDate: {
    fontSize: scale(12),
    fontWeight: '500',
    color: '#374151',
  },
  visitsCount: {
    fontSize: scale(12),
    color: '#4B5563',
  },
  lastVisitText: {
    fontSize: scale(11),
    color: '#6B7280',
  },
  emptyText: {
    fontSize: scale(13),
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: scale(12),
  },
  logHoursBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E6',
    borderWidth: 1.18,
    borderColor: '#FE6700',
    width: 184.56,
    height: 36,
    borderRadius: 14,
    marginTop: scale(16),
    alignSelf: 'center',
  },
  logHoursBtnText: {
    color: '#FE6700',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: '#FFE3D1',
    padding: scale(16),
    marginBottom: scale(16),
    shadowColor: '#FE6700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  seniorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  seniorMeta: {
    flex: 1,
  },
  requestTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5ED',
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    borderRadius: scale(8),
    marginBottom: scale(12),
  },
  requestTimeText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#FF6F00',
  },
  reasonContainer: {
    backgroundColor: '#F9FAFB',
    padding: scale(12),
    borderRadius: scale(8),
    marginBottom: scale(16),
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reasonLabel: {
    fontSize: scale(11),
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: scale(4),
  },
  reasonText: {
    fontSize: scale(13),
    color: '#374151',
    lineHeight: scale(18),
  },
  requestActionsRow: {
    flexDirection: 'row',
    gap: scale(12),
  },
  requestAcceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6F00',
    paddingVertical: scale(10),
    borderRadius: scale(10),
  },
  requestAcceptText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: scale(13),
  },
  requestRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: scale(10),
    borderRadius: scale(10),
  },
  requestRejectText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: scale(13),
  },
  /* Pending Onboarding view styling */
  pendingHeader: {
    alignItems: 'center',
    marginVertical: scale(24),
  },
  brandTitle: {
    fontSize: scale(22),
    fontWeight: '700',
    color: '#FF6F00',
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    padding: scale(24),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    textAlign: 'center',
  },
  pendingTitle: {
    fontSize: scale(18),
    fontWeight: '700',
    color: '#111827',
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  pendingDesc: {
    fontSize: scale(14),
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: scale(20),
    marginBottom: scale(12),
  },
  pendingDescSec: {
    fontSize: scale(12),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: scale(18),
    marginBottom: scale(24),
  },
  refreshBtn: {
    backgroundColor: '#FF6F00',
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    borderRadius: scale(24),
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: scale(14),
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: scale(10),
    paddingHorizontal: scale(20),
    borderRadius: scale(20),
    marginTop: scale(24),
    alignSelf: 'center',
  },
  logoutBtnText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: scale(13),
  },
  cooldownContainer: {
    alignItems: 'center',
    marginVertical: scale(8),
  },
  cooldownText: {
    fontSize: scale(12),
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: scale(12),
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: scale(12),
    padding: scale(16),
    marginVertical: scale(12),
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scale(4),
  },
  infoLabel: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#111827',
  },
  pendingActions: {
    width: '100%',
    marginTop: scale(24),
    gap: scale(12),
    paddingHorizontal: scale(16),
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: scale(12),
    borderRadius: scale(24),
    gap: scale(8),
  },
  actionBtnText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: scale(13),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    padding: scale(20),
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: scale(12),
    marginBottom: scale(16),
  },
  modalTitle: {
    fontSize: scale(17),
    fontWeight: '800',
    color: '#111827',
  },
  modalScroll: {
    marginBottom: scale(20),
  },
  inputGroup: {
    marginBottom: scale(16),
  },
  inputLabel: {
    fontSize: scale(11),
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scale(6),
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: scale(12),
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
    fontSize: scale(14),
    color: '#111827',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#FF6F00',
    paddingVertical: scale(14),
    borderRadius: scale(24),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(8),
    marginBottom: scale(24),
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: scale(14),
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
