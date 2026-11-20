import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LocationEnforcementModalProps {
  visible: boolean;
  onRetryCheck: () => void;
  onEmergencyPunchOut?: () => void;
}

export const LocationEnforcementModal: React.FC<LocationEnforcementModalProps> = ({
  visible,
  onRetryCheck,
  onEmergencyPunchOut,
}) => {
  if (!visible) return null;

  const handleOpenSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (e) {
      console.warn('Failed to open settings:', e);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="location-outline" size={38} color="#DC2626" />
          </View>

          <Text style={styles.title}>Location Access Required</Text>
          <Text style={styles.badgeText}>Mandatory On-Duty Policy</Text>

          <Text style={styles.description}>
            You are currently <Text style={{ fontWeight: '700', color: '#111827' }}>logged in and on duty</Text> as a Care Mitra.
            {'\n\n'}
            For senior safety and real-time operational monitoring, your device GPS/Location must remain turned ON at all times during your work shift.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleOpenSettings}
              activeOpacity={0.85}
            >
              <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Enable Location / Open Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retryBtn}
              onPress={onRetryCheck}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={16} color="#4B5563" />
              <Text style={styles.retryBtnText}>I Turned It On (Check Again)</Text>
            </TouchableOpacity>

            {onEmergencyPunchOut && (
              <TouchableOpacity
                style={styles.emergencyBtn}
                onPress={onEmergencyPunchOut}
                activeOpacity={0.8}
              >
                <Text style={styles.emergencyBtnText}>End Shift (Punch Out)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 99999,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#FEF2F2',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  retryBtn: {
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  retryBtnText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  emergencyBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  emergencyBtnText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
