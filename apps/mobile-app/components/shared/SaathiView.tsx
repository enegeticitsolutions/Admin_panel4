import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import { format } from 'date-fns';
import { API_URL } from '@/constants/api';
import { useSafeBack } from '@/hooks/useSafeBack';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { useRouter } from 'expo-router';
import { useCustomAlert } from '@/contexts/CustomAlertContext';

// Safe date formatter — prevents "Invalid time value" crash when API returns null/undefined dates
const safeFormat = (value: any, fmt: string, fallback = '—'): string => {
  if (!value) return fallback;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return fallback;
    return format(d, fmt);
  } catch {
    return fallback;
  }
};

interface SaathiViewProps {
  beneficiaryId: string;
  initialVolunteerId?: string;
  beneficiaryName?: string;
  accentColor?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export function SaathiView({
  beneficiaryId,
  initialVolunteerId,
  beneficiaryName,
  accentColor = '#FF6A00',
  showBackButton = true,
  onBackPress,
}: SaathiViewProps) {
  const router = useRouter();
  const MAX_CONTENT_WIDTH = 440;
  const responsiveStyle = { width: '100%' as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const };

  const safeBack = useSafeBack();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [remainingUnits, setRemainingUnits] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<'CONNECT' | 'AVAILABLE'>('AVAILABLE');
  const [pendingVolunteers, setPendingVolunteers] = useState<any[]>([]);
  const [connectedVolunteers, setConnectedVolunteers] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState<any | null>(null);

  // Form Fields
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{ title: string; message: string; volunteerName?: string } | null>(null);

  // Date/Time Picker visibility
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isTimePickerVisible, setTimePickerVisibility] = useState(false);

  const [showAllRescheduled, setShowAllRescheduled] = useState(false);
  const [showAllMyRequests, setShowAllMyRequests] = useState(false);

  // Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<any | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  // Reviews State
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [selectedReviews, setSelectedReviews] = useState<any[]>([]);
  const [fetchingReviews, setFetchingReviews] = useState(false);

  // Removed native showAlert in favor of useCustomAlert
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (beneficiaryId) {
      checkEligibility();
    }
  }, [beneficiaryId]);

  const hasAutoSelected = useRef(false);

  // Auto-select initial volunteer if provided
  useEffect(() => {
    if (initialVolunteerId && connectedVolunteers.length > 0 && !hasAutoSelected.current) {
      const vol = connectedVolunteers.find((v: any) => v.id === initialVolunteerId);
      if (vol) {
        setSelectedVolunteer(vol);
        hasAutoSelected.current = true;
      }
    }
  }, [initialVolunteerId, connectedVolunteers]);

  const checkEligibility = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');

      if (!token) {
        showAlert('Error', 'Session Expired');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/beneficiary/sathi-requests/${beneficiaryId}/sathi/eligibility`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setEligible(data.data.eligible);
        setRemainingUnits(data.data.remainingUnits);
        
        if (data.data.eligible) {
          // Fetch linked volunteers
          const volRes = await fetch(`${API_URL}/beneficiary/sathi-requests/${beneficiaryId}/sathi/volunteers`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const volData = await volRes.json();
          if (volData.success) {
            setPendingVolunteers(volData.data.pending || []);
            setConnectedVolunteers(volData.data.connected || []);
          }

          // Fetch my requests
          const reqRes = await fetch(`${API_URL}/beneficiary/sathi-requests/${beneficiaryId}/sathi/my-requests`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const reqData = await reqRes.json();
          if (reqData.success) {
            setMyRequests(reqData.data);
          }
        }
      } else {
        setEligible(false);
      }
    } catch (err) {
      console.error('[SathiEligibility] Error checking eligibility:', err);
      setEligible(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectStatus = async (volunteerId: string, status: 'CONNECTED' | 'REJECTED') => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const res = await fetch(`${API_URL}/beneficiary/sathi-requests/${beneficiaryId}/sathi/volunteers/${volunteerId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      const data = await res.json();
      if (res.ok || data.success) {
        checkEligibility();
        showAlert('Success', status === 'CONNECTED' ? 'Volunteer connected successfully!' : 'Volunteer assignment rejected.');
      } else {
        showAlert('Error', data.message || 'Failed to update status.');
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDate = (selectedDate: Date) => {
    setDate(selectedDate);
    setDatePickerVisibility(false);
    setFormError(null);
  };

  const handleConfirmTime = (selectedTime: Date) => {
    setTime(selectedTime);
    setTimePickerVisibility(false);
    setFormError(null);
  };

  const handleCreateRequest = async () => {
    setFormError(null);
    if (!date) {
      const msg = 'Please select a date for the visit.';
      setFormError(msg);
      showAlert('Error', msg);
      return;
    }
    if (!time) {
      const msg = 'Please select a time for the visit.';
      setFormError(msg);
      showAlert('Error', msg);
      return;
    }
    if (!reason.trim()) {
      const msg = 'Please enter a reason or description for the visit.';
      setFormError(msg);
      showAlert('Error', msg);
      return;
    }
    if (!selectedVolunteer) {
      const msg = 'Please select a volunteer.';
      setFormError(msg);
      showAlert('Error', msg);
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');

      if (!token) {
        const msg = 'Session not found. Please log in.';
        setFormError(msg);
        showAlert('Error', msg);
        setSubmitting(false);
        return;
      }

      // Combine Date and Time
      const combinedDateTime = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        time.getHours(),
        time.getMinutes()
      );

      const res = await fetch(`${API_URL}/beneficiary/sathi-requests/${beneficiaryId}/sathi/visit-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dateTime: combinedDateTime.toISOString(),
          reason: reason.trim(),
          targetVolunteerId: selectedVolunteer.id
        }),
      });

      const data = await res.json();

      if (res.ok || data.success) {
        const volName = selectedVolunteer.name;
        // Show success modal
        setSuccessModal({
          title: 'Request Sent Successfully!',
          message: `Your visit request has been sent to ${volName}. You can track the status under 'My Requests'.`,
          volunteerName: volName,
        });
        // Reset form
        setDate(null);
        setTime(null);
        setReason('');
        setFormError(null);
        checkEligibility();
      } else {
        throw new Error(data.message || 'Failed to submit request.');
      }
    } catch (err: any) {
      const msg = err.message || 'Something went wrong.';
      setFormError(msg);
      showAlert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondReschedule = async (requestId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      
      const res = await fetch(`${API_URL}/beneficiary/sathi-requests/${beneficiaryId}/sathi/visit-requests/${requestId}/respond-reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok || data.success) {
        showAlert('Success', data.message || `Reschedule ${action === 'ACCEPT' ? 'accepted' : 'declined'} successfully.`);
        checkEligibility(); // Refresh list
      } else {
        throw new Error(data.message || 'Failed to respond to reschedule.');
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Network error.');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackTarget) return;
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      
      const res = await fetch(`${API_URL}/beneficiary/sathi-requests/${beneficiaryId}/sathi/volunteers/${feedbackTarget.id}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: feedbackRating, reviewText: feedbackText }),
      });
      const data = await res.json();
      if (res.ok || data.success) {
        showAlert('Success', 'Feedback submitted successfully.');
        setShowFeedbackModal(false);
        setFeedbackTarget(null);
        setFeedbackRating(5);
        setFeedbackText('');
        checkEligibility(); // Refresh list to get new rating
      } else {
        throw new Error(data.message || 'Failed to submit feedback.');
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'Network error.');
    }
  };

  const handleViewReviews = async (volunteer: any) => {
    setFetchingReviews(true);
    setSelectedVolunteer(volunteer); // store the volunteer whose reviews we're viewing
    setShowReviewsModal(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      
      const res = await fetch(`${API_URL}/beneficiary/sathi-requests/${beneficiaryId}/sathi/volunteers/${volunteer.id}/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok || data.success) {
        setSelectedReviews(data.data);
      }
    } catch (err: any) {
      console.log('Failed to fetch reviews', err);
    } finally {
      setFetchingReviews(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.loadingText}>Loading Saathi Network...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!eligible) {
    return (
      <SafeAreaView style={styles.container}>
        {showBackButton && (
          <View style={[styles.header, responsiveStyle]}>
            <TouchableOpacity onPress={() => onBackPress ? onBackPress() : safeBack()} style={styles.backBtn}>
              <Feather name="arrow-left" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Saathi Network</Text>
            <View style={{ width: 24 }} />
          </View>
        )}

        <View style={[styles.content, styles.centerContent, responsiveStyle]}>
          <MaterialCommunityIcons name="account-group-outline" size={64} color={accentColor} style={{ marginBottom: 16 }} />
          <Text style={styles.errorTitle}>Not Eligible</Text>
          <Text style={styles.errorDesc}>
            Your active subscription package does not include Sathi Companion hours. Please contact your coordinator to upgrade your package benefits.
          </Text>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: accentColor }]} onPress={() => onBackPress ? onBackPress() : safeBack()}>
            <Text style={styles.closeBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- RENDER FORM FOR SELECTED VOLUNTEER ---
  if (selectedVolunteer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, responsiveStyle]}>
          <TouchableOpacity onPress={() => setSelectedVolunteer(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Sathi Companion</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={[styles.content, responsiveStyle]} showsVerticalScrollIndicator={false}>
          {/* Info Card */}
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="heart-pulse" size={28} color="#FF6A00" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Companion Hours Available</Text>
              <Text style={styles.infoValue}>{remainingUnits} hours remaining</Text>
            </View>
          </View>
          
          <View style={styles.targetCard}>
            <Text style={styles.targetLabel}>Requesting visit from:</Text>
            <View style={styles.targetInfo}>
               <Image source={{uri: sanitizeImageUri(selectedVolunteer.photo)}} style={styles.targetPhoto} />
               <Text style={styles.targetName}>{selectedVolunteer.name}</Text>
            </View>
          </View>

          {/* Date Selector */}
          <Text style={styles.label}>Select Date</Text>
          {Platform.OS === 'web' ? (
            <input 
              type="date" 
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                border: '1px solid #D1D5DB', fontSize: '14px', color: '#111827',
                fontFamily: 'inherit', outline: 'none'
              }}
              onChange={(e) => {
                if (e.target.value) setDate(new Date(e.target.value));
              }}
            />
          ) : (
            <TouchableOpacity style={styles.pickerField} onPress={() => setDatePickerVisibility(true)}>
              <Feather name="calendar" size={20} color="#6B7280" style={{ marginRight: 10 }} />
              <Text style={[styles.pickerText, !date && { color: '#9CA3AF' }]}>
                {date ? format(date, 'EEEE, d MMMM yyyy') : 'Choose date'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Time Selector */}
          <Text style={styles.label}>Select Time</Text>
          {Platform.OS === 'web' ? (
            <input 
              type="time" 
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                border: '1px solid #D1D5DB', fontSize: '14px', color: '#111827',
                fontFamily: 'inherit', outline: 'none'
              }}
              onChange={(e) => {
                if (e.target.value) {
                  const [hours, minutes] = e.target.value.split(':');
                  const newTime = new Date();
                  newTime.setHours(parseInt(hours, 10));
                  newTime.setMinutes(parseInt(minutes, 10));
                  setTime(newTime);
                }
              }}
            />
          ) : (
            <TouchableOpacity style={styles.pickerField} onPress={() => setTimePickerVisibility(true)}>
              <Feather name="clock" size={20} color="#6B7280" style={{ marginRight: 10 }} />
              <Text style={[styles.pickerText, !time && { color: '#9CA3AF' }]}>
                {time ? format(time, 'hh:mm a') : 'Choose time'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Reason / Notes */}
          <Text style={styles.label}>Reason for Request</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Why do you need companionship today? (e.g., Morning walk, read together, setup medical call...)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            value={reason}
            onChangeText={(txt) => {
              setReason(txt);
              if (formError) setFormError(null);
            }}
          />

          {/* Form Error Banner */}
          {formError && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.disabledBtn]}
            onPress={handleCreateRequest}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Request</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>

        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          minimumDate={new Date()}
          onConfirm={handleConfirmDate}
          onCancel={() => setDatePickerVisibility(false)}
        />
        <DateTimePickerModal
          isVisible={isTimePickerVisible}
          mode="time"
          onConfirm={handleConfirmTime}
          onCancel={() => setTimePickerVisibility(false)}
        />

        {/* Success Modal Overlay */}
        {successModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalSuccessIconWrapper}>
                <Feather name="check" size={28} color="#059669" />
              </View>
              <Text style={styles.modalTitle}>{successModal.title}</Text>
              <Text style={styles.modalDesc}>{successModal.message}</Text>
              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => {
                  setSuccessModal(null);
                  setSelectedVolunteer(null);
                  checkEligibility();
                }}
              >
                <Text style={styles.modalDoneBtnText}>Got it!</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // --- RENDER VOLUNTEER LIST ---
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saathi Network</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={[styles.content, responsiveStyle]} showsVerticalScrollIndicator={false}>
        
        {/* Network Banner */}
        <View style={styles.networkBanner}>
          <View style={styles.heartIconWrapper}>
            <Feather name="heart" size={20} color="#EC4899" />
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>About Saathi Network</Text>
            <Text style={styles.bannerDesc}>
              Saathis provide companionship and support. All interactions are tracked for volunteer credits.
            </Text>
          </View>
        </View>

        {(() => {
          const rescheduledRequestsAll = myRequests.filter(req => req.proposedDateTime != null);
          const otherRequestsAll = myRequests.filter(req => req.proposedDateTime == null);
          
          const rescheduledRequests = showAllRescheduled ? rescheduledRequestsAll : rescheduledRequestsAll.slice(0, 3);
          const otherRequests = showAllMyRequests ? otherRequestsAll : otherRequestsAll.slice(0, 3);
          
          return (
            <>
              {rescheduledRequestsAll.length > 0 && (
                <View style={styles.requestsContainer}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text style={styles.sectionTitle}>Rescheduled Requests</Text>
                    {rescheduledRequestsAll.length > 3 && (
                      <TouchableOpacity onPress={() => setShowAllRescheduled(!showAllRescheduled)}>
                        <Text style={{ color: '#FF6A00', fontWeight: 'bold' }}>
                          {showAllRescheduled ? 'Show Less' : 'View All'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {rescheduledRequests.map((req) => (
                    <View key={req.id} style={styles.requestCard}>
                      <View style={styles.reqHeader}>
                        <Text style={styles.reqDate}>
                          {format(new Date(req.dateTime), 'MMM d, yyyy • h:mm a')}
                        </Text>
                        <View style={[
                          styles.statusBadge, 
                          req.status === 'ACCEPTED' ? styles.statusAccepted : 
                          req.status === 'REJECTED' ? styles.statusRejected : 
                          { backgroundColor: '#FFEDD5' }
                        ]}>
                          <Text style={[
                            styles.statusText,
                            req.status === 'ACCEPTED' ? styles.statusTextAccepted : 
                            req.status === 'REJECTED' ? styles.statusTextRejected : 
                            { color: '#C2410C' }
                          ]}>
                            {req.status === 'ACCEPTED' ? 'RESCHEDULE ACCEPTED' : 
                             req.status === 'REJECTED' ? 'RESCHEDULE REJECTED' : 
                             'RESCHEDULE'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.reqReason} numberOfLines={2}>{req.reason}</Text>

                      {req.status === 'RESCHEDULE_PROPOSED' && req.proposedDateTime && (
                        <View style={{ backgroundColor: '#FFF7ED', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#FED7AA' }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#9A3412', marginBottom: 4 }}>
                            Proposed New Date:
                          </Text>
                          <Text style={{ fontSize: 13, color: '#C2410C', marginBottom: 8 }}>
                            {format(new Date(req.proposedDateTime), 'EEEE, d MMMM yyyy • h:mm a')}
                          </Text>
                          {req.rejectionReason && (
                            <Text style={{ fontSize: 13, color: '#9A3412', fontStyle: 'italic', marginBottom: 12 }}>
                              "{req.rejectionReason}"
                            </Text>
                          )}
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' }}
                              onPress={() => handleRespondReschedule(req.id, 'REJECT')}
                            >
                              <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 13 }}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F97316', alignItems: 'center' }}
                              onPress={() => handleRespondReschedule(req.id, 'ACCEPT')}
                            >
                              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>Accept</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {req.status === 'ACCEPTED' && req.otpCode && (
                        <View style={{ backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8, marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: '#166534', marginBottom: 4 }}>Share this PIN when your Sathi arrives:</Text>
                          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#15803D', letterSpacing: 4 }}>{req.otpCode}</Text>
                        </View>
                      )}

                      {req.status === 'IN_PROGRESS' && (
                        <TouchableOpacity
                          style={{ backgroundColor: '#F97316', paddingVertical: 12, borderRadius: 8, marginTop: 4, marginBottom: 12, alignItems: 'center' }}
                          onPress={async () => {
                            try {
                              const token = await AsyncStorage.getItem('userToken');
                              if (!token) return;
                              
                              const res = await fetch(`${API_URL}/beneficiary/sathi-requests/${beneficiaryId}/sathi/visit-requests/${req.id}/complete`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              if (res.ok) {
                                checkEligibility();
                                showAlert('Success', 'Visit completed!');
                              }
                            } catch (e) {}
                          }}
                        >
                          <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Complete Visit</Text>
                        </TouchableOpacity>
                      )}

                      {req.volunteer && (
                        <View style={styles.reqVolunteer}>
                          <Image source={{uri: sanitizeImageUri(req.volunteer.profilePhoto, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120')}} style={styles.reqVolPhoto} />
                          <Text style={styles.reqVolName}>{req.volunteer.name}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {otherRequestsAll.length > 0 && (
                <View style={styles.requestsContainer}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Text style={styles.sectionTitle}>My Requests</Text>
                    {otherRequestsAll.length > 3 && (
                      <TouchableOpacity onPress={() => setShowAllMyRequests(!showAllMyRequests)}>
                        <Text style={{ color: '#FF6A00', fontWeight: 'bold' }}>
                          {showAllMyRequests ? 'Show Less' : 'View All'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {otherRequests.map((req) => (
                    <View key={req.id} style={styles.requestCard}>
                      <View style={styles.reqHeader}>
                        <Text style={styles.reqDate}>
                          {format(new Date(req.dateTime), 'MMM d, yyyy • h:mm a')}
                        </Text>
                        <View style={[
                          styles.statusBadge, 
                          req.status === 'ACCEPTED' ? styles.statusAccepted : 
                          (req.status === 'REJECTED' && req.rejectionReason === 'Automatically marked as not completed due to timeout.') ? { backgroundColor: '#FEE2E2' } :
                          req.status === 'REJECTED' ? styles.statusRejected : 
                          req.status === 'IN_PROGRESS' ? { backgroundColor: '#DBEAFE' } :
                          req.status === 'COMPLETED' ? { backgroundColor: '#ECFCCB' } :
                          styles.statusPending
                        ]}>
                          <Text style={[
                            styles.statusText,
                            req.status === 'ACCEPTED' ? styles.statusTextAccepted : 
                            (req.status === 'REJECTED' && req.rejectionReason === 'Automatically marked as not completed due to timeout.') ? { color: '#991B1B' } :
                            req.status === 'REJECTED' ? styles.statusTextRejected : 
                            req.status === 'IN_PROGRESS' ? { color: '#1E40AF' } :
                            req.status === 'COMPLETED' ? { color: '#3F6212' } :
                            styles.statusTextPending
                          ]}>
                            {req.status === 'IN_PROGRESS' ? (() => {
                               const start = new Date(req.updatedAt).getTime();
                               const diff = Math.max(0, currentTime.getTime() - start);
                               const h = Math.floor(diff / 3600000);
                               const m = Math.floor((diff % 3600000) / 60000);
                               const s = Math.floor((diff % 60000) / 1000);
                               return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                             })() : 
                             req.status === 'COMPLETED' ? 'COMPLETED' : 
                             (req.status === 'REJECTED' && req.rejectionReason === 'Automatically marked as not completed due to timeout.') ? 'NOT COMPLETED' :
                             req.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.reqReason} numberOfLines={2}>{req.reason}</Text>

                      {req.status === 'ACCEPTED' && req.otpCode && (
                        <View style={{ backgroundColor: '#F0FDF4', padding: 12, borderRadius: 8, marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: '#BBF7D0', alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: '#166534', marginBottom: 4 }}>Share this PIN when your Sathi arrives:</Text>
                          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#15803D', letterSpacing: 4 }}>{req.otpCode}</Text>
                        </View>
                      )}

                      {req.status === 'IN_PROGRESS' && (
                        <TouchableOpacity
                          style={{ backgroundColor: '#F97316', paddingVertical: 12, borderRadius: 8, marginTop: 4, marginBottom: 12, alignItems: 'center' }}
                          onPress={async () => {
                            try {
                              const token = await AsyncStorage.getItem('userToken');
                              if (!token) return;
                              
                              const res = await fetch(`${API_URL}/beneficiary/sathi-requests/${beneficiaryId}/sathi/visit-requests/${req.id}/complete`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              if (res.ok) {
                                checkEligibility();
                                showAlert('Success', 'Visit completed!');
                              }
                            } catch (e) {}
                          }}
                        >
                          <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Complete Visit</Text>
                        </TouchableOpacity>
                      )}
                      {req.volunteer && (
                        <View style={styles.reqVolunteer}>
                          <Image source={{uri: sanitizeImageUri(req.volunteer.profilePhoto, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120')}} style={styles.reqVolPhoto} />
                          <Text style={styles.reqVolName}>{req.volunteer.name}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          );
        })()}

        {/* Custom Tab Bar */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'AVAILABLE' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('AVAILABLE')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'AVAILABLE' && styles.tabBtnTextActive]}>Available Volunteers</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'CONNECT' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('CONNECT')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'CONNECT' && styles.tabBtnTextActive]}>Connect Volunteer</Text>
          </TouchableOpacity>
        </View>

        {/* List Rendering based on Active Tab */}
        {(() => {
          const displayList = activeTab === 'CONNECT' ? pendingVolunteers : connectedVolunteers;
          
          if (displayList.length === 0) {
            return (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {activeTab === 'CONNECT' ? 'No volunteers to connect with.' : 'No available volunteers yet.'}
                </Text>
              </View>
            );
          }
          
          return displayList.map((v) => {
            const isConnectTab = activeTab === 'CONNECT';
            const CardWrapper = (isConnectTab ? View : TouchableOpacity) as React.ElementType;
            const cardProps = isConnectTab ? { style: styles.volunteerCard } : { 
              style: styles.volunteerCard, 
              onPress: () => router.push(`/(beneficiary)/sathi-details/${v.id}?status=CONNECTED`),
              activeOpacity: 0.95
            };

            return (
              <CardWrapper key={v.id} {...cardProps}>
                <View style={styles.volHeader}>
                  <Image source={{ uri: sanitizeImageUri(v.photo) }} style={styles.volPhoto} />
                <View style={styles.volInfo}>
                  <Text style={styles.volName}>{v.name}</Text>
                  
                  <View style={styles.locationRow}>
                    <Feather name="map-pin" size={14} color="#6B7280" />
                    <Text style={styles.locationText}>{v.location}</Text>
                  </View>
                  
                  <View style={styles.volStatsRow}>
                    <TouchableOpacity style={styles.ratingBadge} onPress={() => handleViewReviews(v)}>
                      <FontAwesome name="star" size={14} color="#F59E0B" />
                      <Text style={styles.ratingText}>{v.rating}</Text>
                    </TouchableOpacity>
                    <Text style={styles.visitsText}>{v.visits} visits</Text>
                  </View>
                </View>
              </View>
              
              {/* Availability Box */}
              {v.availability && v.availability.length > 0 && (
                <View style={styles.availabilityBox}>
                  <Feather name="calendar" size={20} color="#16A34A" />
                  <View style={styles.availabilityTextCol}>
                    <Text style={styles.availabilityLabel}>Available</Text>
                    <Text style={styles.availabilityText}>{v.availability.join(', ')}</Text>
                  </View>
                </View>
              )}

              {/* Languages */}
              {v.languages && v.languages.length > 0 && (
                <View style={styles.languagesContainer}>
                  <Text style={[styles.sectionTitleText, { marginLeft: 0 }]}>Languages:</Text>
                  <View style={styles.pillsRow}>
                    {v.languages.map((lang: string, index: number) => (
                      <View key={index} style={styles.languagePill}>
                        <Text style={styles.languagePillText}>{lang}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Interests */}
              {v.interests && v.interests.length > 0 && (
                <View style={styles.interestsContainer}>
                  <Text style={[styles.sectionTitleText, { marginLeft: 0 }]}>Interests:</Text>
                  <View style={styles.pillsRow}>
                    {v.interests.map((interest: string, index: number) => (
                      <View key={index} style={styles.interestPill}>
                        <Text style={styles.interestPillText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {isConnectTab ? (
                  <View style={styles.actionRowSmall}>
                    <TouchableOpacity style={styles.smallViewBtn} onPress={() => router.push(`/(beneficiary)/sathi-details/${v.id}?status=PENDING`)}>
                      <Feather name="eye" size={14} color="#4B5563" style={{ marginRight: 4 }} />
                      <Text style={styles.smallViewBtnText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smallConnectBtn} onPress={() => handleConnectStatus(v.id, 'CONNECTED')}>
                      <Feather name="user-check" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.smallConnectBtnText}>Connect</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smallRejectBtn} onPress={() => handleConnectStatus(v.id, 'REJECTED')}>
                      <Feather name="x" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.smallRejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.reqBtn} onPress={() => setSelectedVolunteer(v)}>
                      <Feather name="user-plus" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.reqBtnText}>Request Visit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.feedBtn} onPress={() => { setFeedbackTarget(v); setShowFeedbackModal(true); setFeedbackRating(5); setFeedbackText(''); }}>
                      <Feather name="message-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.feedBtnText}>Feedback</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </CardWrapper>
            );
          })
        })()}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Feedback Modal */}
      {showFeedbackModal && feedbackTarget && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingTop: 32, paddingBottom: 24, position: 'relative' }]}>
            
            {/* Close Button */}
            <TouchableOpacity 
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4 }}
              onPress={() => setShowFeedbackModal(false)}
            >
              <Feather name="x" size={24} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Avatar */}
            <Image 
              source={{ uri: sanitizeImageUri(feedbackTarget.photo) }} 
              style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 16, borderWidth: 3, borderColor: '#FFF0E6' }}
            />
            
            <Text style={{ fontSize: 15, color: '#6B7280', fontWeight: '500', marginBottom: 4 }}>
              How was your visit with
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 24 }}>
              {feedbackTarget.name}?
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 28 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setFeedbackRating(star)} activeOpacity={0.7}>
                  <FontAwesome
                    name={star <= feedbackRating ? 'star' : 'star-o'}
                    size={40}
                    color={star <= feedbackRating ? '#F59E0B' : '#E5E7EB'}
                    style={{ marginHorizontal: 8 }}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[
                styles.textArea, 
                { 
                  width: '100%', 
                  minHeight: 110, 
                  backgroundColor: '#F9FAFB',
                  borderColor: '#E5E7EB',
                  borderRadius: 16,
                  padding: 16,
                  fontSize: 15,
                  marginBottom: 8
                }
              ]}
              placeholder="Tell us what you liked (or didn't like)..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              value={feedbackText}
              onChangeText={setFeedbackText}
            />

            <View style={{ flexDirection: 'row', width: '100%', marginTop: 16 }}>
              <TouchableOpacity 
                style={[styles.submitBtn, { flex: 1, backgroundColor: '#FF6A00', marginTop: 0, borderRadius: 100 }]} 
                onPress={handleSubmitFeedback}
              >
                <Text style={styles.submitBtnText}>Submit Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Reviews Modal */}
      {showReviewsModal && selectedVolunteer && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Reviews for {selectedVolunteer.name}</Text>
            {fetchingReviews ? (
              <ActivityIndicator size="small" color="#FF6A00" style={{ marginVertical: 24 }} />
            ) : selectedReviews.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#6B7280', marginVertical: 24 }}>No reviews yet.</Text>
            ) : (
              <ScrollView style={{ width: '100%', marginVertical: 12 }} showsVerticalScrollIndicator={false}>
                {selectedReviews.map((rev: any) => (
                  <View key={rev.id} style={{ borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontWeight: 'bold', color: '#1F2937' }}>{rev.beneficiary?.name || 'User'}</Text>
                      <View style={{ flexDirection: 'row' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FontAwesome key={star} name={star <= rev.rating ? 'star' : 'star-o'} size={12} color="#FBBF24" />
                        ))}
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>{format(new Date(rev.createdAt), 'MMM d, yyyy')}</Text>
                    {rev.reviewText && <Text style={{ color: '#4B5563', fontSize: 14 }}>{rev.reviewText}</Text>}
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={[styles.modalDoneBtn, { width: '100%', marginTop: 12 }]} onPress={() => setShowReviewsModal(false)}>
              <Text style={styles.modalDoneBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF0E6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FF6900',
    borderRadius: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  closeBtn: {
    backgroundColor: '#FF6A00',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE3D1',
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  targetCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  targetLabel: {
    fontSize: 12,
    color: '#C2410C',
    fontWeight: '600',
    marginBottom: 8,
  },
  targetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  targetName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9A3412',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    height: 100,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#FF6A00',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  // Network List Styles
  networkBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  heartIconWrapper: {
    marginRight: 12,
    marginTop: 2,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  bannerDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 28,
    color: '#000000',
    marginBottom: 16,
  },
  requestsContainer: {
    marginBottom: 24,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reqDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusAccepted: {
    backgroundColor: '#D1FAE5',
  },
  statusRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextPending: {
    color: '#D97706',
  },
  statusTextAccepted: {
    color: '#059669',
  },
  statusTextRejected: {
    color: '#DC2626',
  },
  reqReason: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
  },
  reqVolunteer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  reqVolPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  reqVolName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
  volunteerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  volHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  volPhoto: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginRight: 16,
  },
  volInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  volName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 4,
  },
  volStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 6,
  },
  visitsText: {
    fontSize: 14,
    color: '#6B7280',
  },
  volBio: {
    fontSize: 14,
    fontWeight: '400',
    color: '#364153',
    lineHeight: 20,
    marginBottom: 16,
  },
  volHoursContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  volHoursBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
  },
  volHoursText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: '#4A5565',
    marginLeft: 8,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  reqBtn: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#2563EB', // Blue matching Connect
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reqBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  feedBtn: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#EA580C', // Orange matching Chat
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  feedBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  actionRowSmall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    justifyContent: 'space-between',
  },
  smallViewBtn: {
    flex: 1,
    minWidth: 80,
    backgroundColor: '#F3F4F6', // Gray
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  smallViewBtnText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 13,
  },
  smallConnectBtn: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#2563EB', // Blue
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  smallConnectBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  smallRejectBtn: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#EA580C', // Orange
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  smallRejectBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFE3D1',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9A3412',
  },
  tabBtnTextActive: {
    color: '#EA580C',
  },
  availabilityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  availabilityTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  availabilityLabel: {
    color: '#16A34A',
    fontSize: 13,
  },
  availabilityText: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  languagesContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleText: {
    color: '#4B5563',
    fontSize: 15,
    marginLeft: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languagePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  languagePillText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },
  interestsContainer: {
    marginBottom: 16,
  },
  interestPill: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  interestPillText: {
    color: '#9333EA',
    fontSize: 14,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
    flex: 1,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalSuccessIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalDoneBtn: {
    backgroundColor: '#FF6A00',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
