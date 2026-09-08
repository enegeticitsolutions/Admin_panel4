import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '@/constants/api';
import { SathiBottomNav } from '@/components/shared/SathiBottomNav';
import { useExitOnBack } from '@/hooks/useExitOnBack';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

const DEEP_ORANGE = '#FE6700';

export default function SathiHours() {
  useExitOnBack();
  useAndroidBackHandler();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [assignedMatches, setAssignedMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [visitHistory, setVisitHistory] = useState<any[]>([]);
  const [creditsLedger, setCreditsLedger] = useState<any[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<any[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllLedger, setShowAllLedger] = useState(false);

  // OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [targetVisit, setTargetVisit] = useState<any>(null);

  // Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackTargetId, setFeedbackTargetId] = useState<string | null>(null);

  // Timer state for active visit
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  const loadHoursData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      // 1. Fetch Dashboard to check active visit log session
      const dashRes = await fetch(`${API_URL}/sathi/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dash = await dashRes.json();
      const dashData = dash.data || dash;
      setActiveSession(dashData.activeVisit || null);
      setUpcomingVisits(dashData.upcomingVisits || []);

      // 2. Fetch Assignments matches list
      const matchesRes = await fetch(`${API_URL}/sathi/matches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const matchesData = await matchesRes.json();
      const matches = matchesData.data || matchesData;
      setAssignedMatches(matches || []);
      if (matches && matches.length > 0 && !selectedMatch) {
        setSelectedMatch(matches[0]);
      }

      // 3. Fetch completed visit history logs
      const historyRes = await fetch(`${API_URL}/sathi/hours`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const historyData = await historyRes.json();
      setVisitHistory(historyData.data || historyData || []);

      // 4. Fetch credits points transaction ledger
      const creditsRes = await fetch(`${API_URL}/sathi/credits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const creditsData = await creditsRes.json();
      setCreditsLedger(creditsData.data || creditsData || []);

    } catch (err) {
      console.log('Error fetching hours records:', err);
      setError('Unable to load visit records. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHoursData();
    }, [])
  );

  // Active visit elapsed time counter tick
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => {
      const start = new Date(activeSession.checkInTime).getTime();
      const now = new Date().getTime();
      const diff = now - start;

      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      const fHrs = hrs.toString().padStart(2, '0');
      const fMins = mins.toString().padStart(2, '0');
      const fSecs = secs.toString().padStart(2, '0');

      setElapsedTime(`${fHrs}:${fMins}:${fSecs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const handleCheckin = async () => {
    if (!targetVisit) {
      Alert.alert('Selection Required', 'No valid visit request selected.');
      return;
    }
    if (!otpCode || otpCode.length !== 4) {
      Alert.alert('Invalid OTP', 'Please enter the 4-digit PIN provided by the beneficiary.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/sathi/visits/checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          beneficiaryId: selectedMatch.beneficiary.id,
          assignmentId: selectedMatch.assignmentId,
          visitRequestId: targetVisit.id,
          otpCode
        })
      });

      const data = await response.json();
      if (response.ok || data.success) {
        setShowOtpModal(false);
        setOtpCode('');
        Alert.alert('Checked In', 'Visit session started successfully!');
        loadHoursData();
      } else {
        Alert.alert('Check-In Failed', data.message || 'Verification conflict.');
      }
    } catch (err) {
      console.log('Check-in failed:', err);
      Alert.alert('Error', 'Connection to backend API failed.');
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim() || !feedbackTargetId) {
      Alert.alert('Error', 'Please enter some feedback first.');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_URL}/sathi/visits/${feedbackTargetId}/feedback`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ feedback: feedbackText })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Feedback failed');
      
      Alert.alert('Success', 'Thank you for your feedback!');
      setShowFeedbackModal(false);
      setFeedbackText('');
      setFeedbackTargetId(null);
      loadHoursData(); // Refresh history
    } catch (err) {
      console.log('Feedback submission failed:', err);
      Alert.alert('Error', 'Unable to submit feedback. Please try again.');
    }
  };

  const getClosestVisit = (beneficiaryId: string) => {
    const visits = upcomingVisits.filter(
      (v) => v.beneficiaryId === beneficiaryId && v.status === 'ACCEPTED'
    );
    if (visits.length === 0) return null;
    
    // Sort by dateTime ascending
    visits.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    return visits[0];
  };

  const openCheckinPrompt = () => {
    if (!selectedMatch) return;
    const closest = getClosestVisit(selectedMatch.beneficiary.id);
    if (!closest) {
      Alert.alert('No Visit', 'There are no upcoming scheduled visits for this beneficiary.');
      return;
    }

    const visitTime = new Date(closest.dateTime).getTime();
    const now = new Date().getTime();
    // Allow check-in 30 mins before
    if (visitTime - now > 30 * 60 * 1000) {
      const timeStr = new Date(closest.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      Alert.alert('Too Early', `The next visit is scheduled for ${timeStr}. You can check-in up to 30 minutes before.`);
      return;
    }

    setTargetVisit(closest);
    setOtpCode('');
    setShowOtpModal(true);
  };

  // Checkout is now handled by the beneficiary from their app.
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={DEEP_ORANGE} />
        <Text style={styles.loaderText}>Loading visit records...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="wifi-off" size={64} color="#D1D5DB" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#4B5563', textAlign: 'center', paddingHorizontal: 32 }}>
          {error}
        </Text>
        <TouchableOpacity 
          style={{ marginTop: 24, backgroundColor: DEEP_ORANGE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          onPress={() => { setLoading(true); setError(null); loadHoursData(); }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandTitle}>Saathi Network</Text>
          <Text style={styles.title}>Log Companion Hours</Text>
        </View>

        {/* Visit Logger Interface Card */}
        {activeSession ? (
          /* Active visit / Checkout mode */
          <View style={styles.activeCard}>
            <View style={styles.rowAlign}>
              <MaterialCommunityIcons name="timer-sand" size={32} color="#FE6700" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.activeTitle}>Active Visit Session</Text>
                <Text style={styles.activeSubtitle}>Volunteering Companion</Text>
              </View>
            </View>

            <Text style={styles.timerVal}>{elapsedTime}</Text>

            <View style={{ marginTop: 16, backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8 }}>
              <Text style={{ color: '#92400E', fontFamily: 'Poppins-Medium', textAlign: 'center', fontSize: 13 }}>
                Waiting for beneficiary to confirm completion from their app.
              </Text>
            </View>
          </View>
        ) : (
          /* Checkin mode */
          <View style={styles.loggerCard}>
            <Text style={styles.cardTitle}>Start Visit check-in</Text>
            <Text style={styles.cardDesc}>
              Select your matched senior beneficiary from the list below and check-in to begin logging your hours.
            </Text>

            {assignedMatches.length > 0 ? (
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>Matched Seniors</Text>
                <View style={styles.matchesRow}>
                  {assignedMatches.map((m) => {
                    const closest = getClosestVisit(m.beneficiary.id);
                    let infoText = 'No upcoming visit';
                    let canStart = false;
                    
                    if (closest) {
                      const visitTime = new Date(closest.dateTime).getTime();
                      const now = new Date().getTime();
                      const timeStr = new Date(closest.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      
                      if (visitTime - now <= 30 * 60 * 1000) {
                        infoText = `Starts at ${timeStr} (Ready)`;
                        canStart = true;
                      } else {
                        infoText = `Starts at ${timeStr}`;
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={m.assignmentId}
                        style={[
                          styles.matchSelector,
                          selectedMatch?.assignmentId === m.assignmentId && styles.matchSelectorActive
                        ]}
                        onPress={() => setSelectedMatch(m)}
                      >
                        <Text
                          style={[
                            styles.matchSelectorText,
                            selectedMatch?.assignmentId === m.assignmentId && styles.matchSelectorTextActive
                          ]}
                        >
                          {m.beneficiary.name}
                        </Text>
                        <Text style={[
                          { fontSize: 10, marginTop: 4 },
                          selectedMatch?.assignmentId === m.assignmentId ? { color: '#FFE0B2' } : { color: '#9CA3AF' }
                        ]}>
                          {infoText}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {(() => {
                  const closest = selectedMatch ? getClosestVisit(selectedMatch.beneficiary.id) : null;
                  const canStart = closest && (new Date(closest.dateTime).getTime() - new Date().getTime() <= 30 * 60 * 1000);
                  
                  return (
                    <TouchableOpacity 
                      style={[styles.checkinBtn, !canStart && { backgroundColor: '#D1D5DB' }]} 
                      onPress={openCheckinPrompt}
                      disabled={!canStart}
                    >
                      <Text style={styles.checkinBtnText}>Check-In Now</Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            ) : (
              <Text style={styles.emptyPrompt}>
                You do not have any matched seniors assigned yet. Go to matches to request senior pairings.
              </Text>
            )}
          </View>
        )}

        {/* OTP Modal */}
        <Modal visible={showOtpModal} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback accessible={false}>
                  <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter PIN</Text>
              <Text style={styles.modalDesc}>
                Ask {selectedMatch?.beneficiary.name} for the 4-digit PIN displayed on their app to start the visit.
              </Text>

              <TextInput
                style={styles.otpInput}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="numeric"
                maxLength={4}
                placeholder="0000"
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowOtpModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalSubmitBtn, otpCode.length !== 4 && { opacity: 0.6 }]} 
                  onPress={handleCheckin}
                  disabled={otpCode.length !== 4}
                >
                  <Text style={styles.modalSubmitText}>Verify & Start</Text>
                </TouchableOpacity>
              </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Feedback Modal */}
        <Modal
          visible={showFeedbackModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFeedbackModal(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback accessible={false}>
                  <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Visit Feedback</Text>
              <Text style={styles.modalSubtitle}>How was your visit? Any notes or concerns?</Text>
              
              <TextInput
                style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Type your feedback here..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
              />

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowFeedbackModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalSubmitBtn, !feedbackText.trim() && { opacity: 0.6 }]} 
                  onPress={handleFeedbackSubmit}
                  disabled={!feedbackText.trim()}
                >
                  <Text style={styles.modalSubmitText}>Submit</Text>
                </TouchableOpacity>
              </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Visit Logs History */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={styles.sectionTitle}>Completed Visits History</Text>
          {visitHistory.length > 2 && (
            <TouchableOpacity onPress={() => setShowAllHistory(!showAllHistory)}>
              <Text style={{ color: '#FE6700', fontWeight: 'bold' }}>
                {showAllHistory ? 'Show Less' : 'View All'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {visitHistory.length > 0 ? (
          (showAllHistory ? visitHistory : visitHistory.slice(0, 2)).map((item) => (
              <View key={item.id} style={[styles.historyItem, { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={styles.historyName}>{item.beneficiary?.name}</Text>
                    <Text style={styles.historyDate}>
                      📅 {new Date(item.checkInTime).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.historyMetrics}>
                    <Text style={styles.historyHours}>
                      {item.minutesLogged 
                        ? `${Math.floor(item.minutesLogged / 60)}h ${Math.floor(item.minutesLogged % 60)}m`
                        : `${item.hoursEarned?.toFixed(1)} hrs`}
                    </Text>
                    <Text style={styles.historyPoints}>+{item.creditPointsEarned?.toFixed(0)} pts</Text>
                  </View>
                </View>
                {/* Feedback Button for History Items */}
                {!item.feedback && (
                  <TouchableOpacity 
                    style={{ marginTop: 12, backgroundColor: '#FFF3E0', padding: 10, borderRadius: 8, alignItems: 'center' }}
                    onPress={() => {
                      setFeedbackTargetId(item.id);
                      setFeedbackText('');
                      setShowFeedbackModal(true);
                    }}
                  >
                    <Text style={{ color: DEEP_ORANGE, fontWeight: '600', fontSize: 13 }}>+ Add Feedback</Text>
                  </TouchableOpacity>
                )}
                {item.feedback && (
                  <View style={{ marginTop: 12, backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8 }}>
                    <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>Your Feedback:</Text>
                    <Text style={{ fontSize: 13, color: '#374151' }}>{item.feedback}</Text>
                  </View>
                )}
              </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No completed visits logged.</Text>
        )}

        {/* Credits Ledger Transaction Ledger */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Points Ledger & History</Text>
          {creditsLedger.length > 5 && (
            <TouchableOpacity onPress={() => setShowAllLedger(!showAllLedger)}>
              <Text style={{ color: '#FE6700', fontWeight: 'bold', fontSize: 13 }}>
                {showAllLedger ? 'Show Less' : 'View All'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {creditsLedger.length > 0 ? (
          (showAllLedger ? creditsLedger : creditsLedger.slice(0, 5)).map((item) => {
            const isEarned = item.pointsDelta >= 0;
            return (
              <View key={item.id} style={styles.ledgerItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ledgerDesc} numberOfLines={1}>
                    {item.description || (isEarned ? 'Companion visit completed' : 'Reward redeemed')}
                  </Text>
                  <Text style={styles.ledgerDate}>
                    {new Date(item.createdAt || Date.now()).toLocaleString()}
                  </Text>
                </View>
                <Text style={[styles.ledgerPoints, !isEarned && { color: '#EF4444' }]}>
                  {isEarned ? '+' : ''}{item.pointsDelta?.toFixed(0)} pts
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No ledger transactions recorded.</Text>
        )}

        <TouchableOpacity
          style={{
            backgroundColor: '#111827',
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            marginTop: 8,
            marginBottom: 20,
            flexDirection: 'row',
            justifyContent: 'center'
          }}
          onPress={() => router.push('/(sathi)/credits')}
        >
          <Ionicons name="gift" size={20} color="#FFB74D" style={{ marginRight: 8 }} />
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
            Explore Rewards & Redeem Options
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <SathiBottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF3EB',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 100,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loaderText: {
    marginTop: 12,
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
  },
  header: {
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6F00',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  loggerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 16,
  },
  pickerContainer: {
    marginTop: 8,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  matchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  matchSelector: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  matchSelectorActive: {
    backgroundColor: '#FF6F00',
  },
  matchSelectorText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  matchSelectorTextActive: {
    color: '#FFFFFF',
  },
  checkinBtn: {
    backgroundColor: '#FF6F00',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkinBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyPrompt: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  activeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFD3B6',
    padding: 18,
    marginBottom: 24,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  activeSubtitle: {
    fontSize: 11,
    color: '#FE6700',
    fontWeight: '600',
  },
  timerVal: {
    fontSize: 42,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginVertical: 20,
    fontVariant: ['tabular-nums'],
  },
  notesInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111827',
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  checkoutBtn: {
    backgroundColor: '#FF6F00',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    marginTop: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  historyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  historyDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  historyMetrics: {
    alignItems: 'flex-end',
  },
  historyHours: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  historyPoints: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 2,
  },
  ledgerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 10,
  },
  ledgerDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  ledgerDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  ledgerPoints: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalDesc: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#111827',
    fontSize: 15,
    marginBottom: 24,
    width: '100%',
  },
  otpInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    fontSize: 32,
    letterSpacing: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    color: '#111827',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 24,
    width: '100%',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 15,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#FF6F00',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
