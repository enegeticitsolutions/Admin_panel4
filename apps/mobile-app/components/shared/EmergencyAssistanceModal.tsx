import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface EmergencyAssistanceModalProps {
  visible: boolean;
  loading?: boolean;
  countdownSeconds?: number;
  onCancel: () => void;
  onConfirmCall: () => void | Promise<void>;
}

export function EmergencyAssistanceModal({
  visible,
  loading = false,
  countdownSeconds = 5,
  onCancel,
  onConfirmCall,
}: EmergencyAssistanceModalProps) {
  const insets = useSafeAreaInsets();
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);
  const hasTriggeredRef = useRef(false);
  const onConfirmCallRef = useRef(onConfirmCall);

  useEffect(() => {
    onConfirmCallRef.current = onConfirmCall;
  }, [onConfirmCall]);

  // Reset countdown whenever the modal opens
  useEffect(() => {
    if (visible) {
      hasTriggeredRef.current = false;
      setSecondsLeft(countdownSeconds);
    }
  }, [visible, countdownSeconds]);

  const triggerCall = useCallback(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    onConfirmCallRef.current();
  }, []);

  // Tick down 1 second at a time while visible and not loading
  useEffect(() => {
    if (!visible || loading) return;

    if (secondsLeft <= 0) {
      triggerCall();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, loading, secondsLeft, triggerCall]);

  const handleCancel = () => {
    if (loading) return;
    hasTriggeredRef.current = true;
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleCancel}>
          <View style={styles.backdropTouchArea} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          {/* Top Red Header */}
          <View style={styles.headerSection}>
            <View style={styles.iconBadge}>
              <Feather name="life-buoy" size={31} color="#FFFFFF" />
            </View>

            <Text style={styles.title}>Emergency assistance</Text>

            <Text style={styles.subtitle}>
              {"We'll call the 24/7 MHN Emergency Desk and alert your emergency contacts."}
            </Text>
          </View>

          {/* Bottom White Body */}
          <View
            style={[
              styles.bodySection,
              { paddingBottom: Math.max(24, insets.bottom + 16) },
            ]}
          >
            {/* Countdown Banner */}
            <View style={styles.countdownBanner}>
              <Feather name="clock" size={20} color="#B92F2F" />
              <Text style={styles.countdownText}>
                {loading
                  ? 'Connecting to Emergency Desk...'
                  : `Call starts in ${secondsLeft} ${secondsLeft === 1 ? 'second' : 'seconds'}`}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.callNowBtn, loading && styles.btnDisabled]}
                onPress={triggerCall}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.callNowBtnText}>Call now</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancel}
                activeOpacity={0.85}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>{"I'm safe — cancel"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdropTouchArea: {
    flex: 1,
    width: '100%',
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  headerSection: {
    backgroundColor: '#E53E3E',
    padding: 28,
    alignItems: 'center',
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginTop: 16,
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 8,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 23,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bodySection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  countdownBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    minHeight: 56,
    backgroundColor: '#FFF1F1',
    borderRadius: 16,
    marginBottom: 20,
  },
  countdownText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#B92F2F',
  },
  actionsContainer: {
    gap: 12,
  },
  callNowBtn: {
    width: '100%',
    minHeight: 56,
    backgroundColor: '#E53E3E',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.75,
  },
  callNowBtnText: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  cancelBtn: {
    width: '100%',
    minHeight: 48,
    backgroundColor: '#F3F1EF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#4B5563',
  },
});
