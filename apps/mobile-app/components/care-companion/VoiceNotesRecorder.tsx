import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';

interface VoiceNotesRecorderProps {
  visitId: string;
  token: string;
  onTranscribed: (transcript: string) => void;
  disabled?: boolean;
}

const MAX_RECORDING_SECONDS = 120; // 2 minutes auto-cutoff

export const VoiceNotesRecorder: React.FC<VoiceNotesRecorderProps> = ({
  visitId,
  token,
  onTranscribed,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [durationSecs, setDurationSecs] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for recording badge
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Clean up recording and timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const startRecording = async () => {
    if (disabled || isRecording || isTranscribing) return;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Please allow microphone access in device settings to dictate visit notes.'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setDurationSecs(0);

      // Start duration ticker
      timerRef.current = setInterval(() => {
        setDurationSecs((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopAndTranscribe();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      Alert.alert('Recording Error', 'Could not access device microphone. Please try again.');
      setIsRecording(false);
    }
  };

  const cancelRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch (e) {
      // Ignored
    } finally {
      setIsRecording(false);
      setDurationSecs(0);
    }
  };

  const stopAndTranscribe = async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      const recording = recordingRef.current;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (!uri) {
        throw new Error('No audio file was created');
      }

      // Upload audio to Gemini speech-to-text API
      const formData = new FormData();
      formData.append('audio', {
        uri,
        name: 'visit-note.m4a',
        type: 'audio/m4a',
      } as any);

      const response = await fetch(`${API_URL}/care-companion/visits/${visitId}/ai/transcribe-voice`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Let fetch set multi-part boundary automatically
        },
        body: formData,
      });

      const json = await response.json();
      if (json.success && json.data?.transcript) {
        onTranscribed(json.data.transcript);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (json.data?.transcript === '') {
        Alert.alert(
          'No Speech Detected',
          'We could not hear any clear voice observations. Please try speaking closer to the mic.'
        );
      } else {
        Alert.alert('Transcription Failed', json.message || 'Could not transcribe voice notes.');
      }
    } catch (err: any) {
      console.error('Voice upload error:', err);
      Alert.alert(
        'Upload Error',
        'Could not complete voice transcription. You can still type notes manually.'
      );
    } finally {
      setIsTranscribing(false);
      setDurationSecs(0);
    }
  };

  if (isTranscribing) {
    return (
      <View style={styles.transcribingContainer}>
        <ActivityIndicator size="small" color="#4F46E5" />
        <Text style={styles.transcribingText}>Transcribing with AI...</Text>
      </View>
    );
  }

  if (isRecording) {
    return (
      <View style={styles.recordingContainer}>
        <Animated.View style={[styles.redDot, { transform: [{ scale: pulseAnim }] }]} />
        <Text style={styles.recordingTimer}>{formatTimer(durationSecs)}</Text>

        <View style={styles.recordingControls}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={cancelRecording}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color="#EF4444" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={stopAndTranscribe}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.dictateBtn, disabled && { opacity: 0.5 }]}
      onPress={startRecording}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Ionicons name="mic" size={16} color="#4F46E5" style={{ marginRight: 5 }} />
      <Text style={styles.dictateBtnText}>Dictate Voice</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  dictateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  dictateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    fontFamily: 'Poppins-Medium',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginRight: 6,
  },
  recordingTimer: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: 'Poppins-Bold',
    marginRight: 10,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 13,
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Poppins-Medium',
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  transcribingText: {
    fontSize: 12,
    color: '#4F46E5',
    marginLeft: 6,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
});
