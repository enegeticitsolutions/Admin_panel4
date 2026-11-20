import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActiveShiftSession, TodayShiftSummary } from '@/hooks/useDutyLocationEnforcer';

interface DutyAttendanceCardProps {
  isWorking: boolean;
  activeSession: ActiveShiftSession | null;
  todaySummary: TodayShiftSummary;
  elapsedSeconds: number;
  actionLoading: boolean;
  onPunchIn: () => Promise<{ success: boolean; message?: string }>;
  onPunchOut: () => Promise<{ success: boolean; durationMinutes?: number; message?: string }>;
  style?: any;
}

export const DutyAttendanceCard: React.FC<DutyAttendanceCardProps> = ({
  isWorking,
  activeSession,
  todaySummary,
  elapsedSeconds,
  actionLoading,
  onPunchIn,
  onPunchOut,
  style,
}) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Format elapsed seconds to HH:MM:SS
  const formatTimer = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const formatTimeStr = (isoString?: string | null): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handlePunchInPress = async () => {
    const res = await onPunchIn();
    if (!res.success && res.message) {
      Alert.alert('Punch In Failed', res.message);
    }
  };

  const handleConfirmPunchOut = async () => {
    setShowConfirmModal(false);
    const res = await onPunchOut();
    if (res.success) {
      const mins = res.durationMinutes || 0;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const durationMsg = h > 0 ? `${h}h ${m}m` : `${m} minutes`;
      Alert.alert('Shift Ended', `You have clocked out. Total session duration: ${durationMsg}. Good job today!`);
    } else if (res.message) {
      Alert.alert('Punch Out Failed', res.message);
    }
  };

  if (isWorking) {
    return (
      <View style={[styles.activeCard, style]}>
        <View style={styles.topRow}>
          <View style={styles.statusBadge}>
            <View style={styles.pulsingDot} />
            <Text style={styles.statusTextActive}>On Duty (Working)</Text>
          </View>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>⏱️ {formatTimer(elapsedSeconds)}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Shift Started</Text>
            <Text style={styles.infoValue}>
              {formatTimeStr(activeSession?.loginTime) || 'Just now'}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Live Location</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="radio-outline" size={12} color="#059669" />
              <Text style={[styles.infoValue, { color: '#059669' }]}>Tracking Active</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.punchOutBtn}
          onPress={() => setShowConfirmModal(true)}
          disabled={actionLoading}
          activeOpacity={0.8}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
              <Text style={styles.punchOutBtnText}>Punch Out (End Shift)</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Confirmation Modal */}
        <Modal visible={showConfirmModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalIconCircle}>
                <Ionicons name="log-out-outline" size={32} color="#DC2626" />
              </View>
              <Text style={styles.modalTitle}>End Your Shift?</Text>
              <Text style={styles.modalSubtitle}>
                You have been on duty for{' '}
                <Text style={{ fontWeight: '700', color: '#111827' }}>
                  {formatTimer(elapsedSeconds)}
                </Text>
                . Punching out will log your departure attendance and stop real-time location tracking.
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowConfirmModal(false)}
                >
                  <Text style={styles.modalCancelText}>Keep Working</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleConfirmPunchOut}
                >
                  <Text style={styles.modalConfirmText}>Punch Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Off-Duty State
  return (
    <View style={[styles.inactiveCard, style]}>
      <View style={styles.inactiveLeft}>
        <View style={styles.inactiveIconCircle}>
          <Ionicons name="time-outline" size={24} color="#EA580C" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.grayDot} />
            <Text style={styles.inactiveTitle}>Off Duty / Not Logged In</Text>
          </View>
          <Text style={styles.inactiveSub}>
            {todaySummary.totalHoursWorked > 0
              ? `Logged ${todaySummary.totalHoursWorked}h today. Ready to clock in?`
              : 'Punch in to start your shift & receive visits.'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.punchInBtn}
        onPress={handlePunchInPress}
        disabled={actionLoading}
        activeOpacity={0.85}
      >
        {actionLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="finger-print-outline" size={18} color="#FFFFFF" />
            <Text style={styles.punchInBtnText}>Punch In</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  activeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: '#10B981',
    marginVertical: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 6,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  timerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  timerText: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  infoRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoCol: {
    flex: 1,
    alignItems: 'center',
  },
  infoDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  punchOutBtn: {
    backgroundColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  punchOutBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  inactiveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inactiveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  inactiveIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  grayDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#9CA3AF',
  },
  inactiveTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  inactiveSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 15,
  },
  punchInBtn: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    gap: 6,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  punchInBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
