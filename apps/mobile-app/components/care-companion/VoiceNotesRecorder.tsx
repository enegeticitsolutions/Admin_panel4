import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';

interface VoiceNotesRecorderProps {
  visitId: string;
  token: string;
  onTranscribed: (transcript: string) => void;
  onStatusChange?: (status: 'idle' | 'recording' | 'uploading' | 'transcribing') => void;
  disabled?: boolean;
}

type RecorderStage = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'failed';

const MAX_RECORDING_SECONDS = 180; // 3 minutes maximum cutoff for visit notes

/**
 * Compressed Audio Recording Preset:
 * - Format: M4A / AAC
 * - Channels: 1 (Mono)
 * - Sample Rate: 16,000 Hz (Ideal for voice transcription)
 * - Bitrate: 32,000 bps (32 kbps)
 * Results in ~240 KB per minute, minimizing upload time and cellular data usage.
 */
const COMPRESSED_VOICE_RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 32000,
  },
};

export const VoiceNotesRecorder: React.FC<VoiceNotesRecorderProps> = ({
  visitId,
  token,
  onTranscribed,
  onStatusChange,
  disabled = false,
}) => {
  const [stage, setStage] = useState<RecorderStage>('idle');
  const [durationSecs, setDurationSecs] = useState(0);
  const [lastAudioUri, setLastAudioUri] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const abortControllerRef = useRef<AbortController | null>(null);

  const updateStage = (newStage: RecorderStage) => {
    setStage(newStage);
    if (onStatusChange && newStage !== 'failed') {
      onStatusChange(newStage);
    }
  };

  // Pulse animation for recording indicator
  useEffect(() => {
    if (stage === 'recording') {
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
  }, [stage]);

  // Cleanup recording, timers, and active controllers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
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
    if (disabled || stage !== 'idle') return;

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
      await recording.prepareToRecordAsync(COMPRESSED_VOICE_RECORDING_OPTIONS);
      await recording.startAsync();

      recordingRef.current = recording;
      setLastAudioUri(null);
      setDurationSecs(0);
      updateStage('recording');

      // 1-second interval ticker with max duration protection
      timerRef.current = setInterval(() => {
        setDurationSecs((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopAndProcessAudio();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      Alert.alert('Recording Error', 'Could not access device microphone. Please try again.');
      updateStage('idle');
    }
  };

  const cancelRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
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
      // Ignore cleanup error
    } finally {
      updateStage('idle');
      setDurationSecs(0);
      setLastAudioUri(null);
    }
  };

  /**
   * Stops recording and initiates direct S3 upload with multipart fallback.
   */
  const stopAndProcessAudio = async () => {
    if (!recordingRef.current && !lastAudioUri) return;
    if (timerRef.current) clearInterval(timerRef.current);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let audioUri = lastAudioUri;

    try {
      if (recordingRef.current) {
        const recording = recordingRef.current;
        await recording.stopAndUnloadAsync();
        audioUri = recording.getURI();
        recordingRef.current = null;
        setLastAudioUri(audioUri);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (!audioUri) {
        throw new Error('No audio file was created');
      }

      await uploadAndTranscribe(audioUri);
    } catch (err: any) {
      console.error('Recording processing error:', err);
      updateStage('failed');
      Alert.alert(
        'Upload Failed',
        'Could not complete voice transcription. You can retry upload or type notes manually.'
      );
    }
  };

  /**
   * Upload pipeline:
   * 1. Attempt direct pre-signed S3 upload (zero memory overhead on backend)
   * 2. Call transcribe-voice with storageKey
   * 3. Fallback: If pre-signed upload fails, use standard multipart upload
   */
  const uploadAndTranscribe = async (audioUri: string) => {
    abortControllerRef.current = new AbortController();
    const mimeType = 'audio/m4a';

    // Step 1: Request Pre-signed S3 URL
    updateStage('uploading');

    let directS3Success = false;
    let uploadedStorageKey: string | null = null;

    try {
      const presignedRes = await fetch(
        `${API_URL}/care-companion/visits/${visitId}/ai/presigned-audio-upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mimeType }),
          signal: abortControllerRef.current.signal,
        }
      );

      const presignedJson = await presignedRes.json();

      if (presignedJson.success && presignedJson.data?.uploadUrl) {
        const { uploadUrl, storageKey } = presignedJson.data;

        // Perform direct binary upload to S3 / storage
        if (Platform.OS === 'web') {
          const blobRes = await fetch(audioUri);
          const blob = await blobRes.blob();
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: blob,
            signal: abortControllerRef.current.signal,
          });

          if (uploadRes.ok) {
            directS3Success = true;
            uploadedStorageKey = storageKey;
          }
        } else {
          // Native iOS / Android via FileSystem binary upload
          const uploadResult = await FileSystem.uploadAsync(uploadUrl, audioUri, {
            httpMethod: 'PUT',
            uploadType: 0, // FileSystemUploadType.BINARY_CONTENT
            headers: {
              'Content-Type': mimeType,
            },
          });

          if (uploadResult.status >= 200 && uploadResult.status < 300) {
            directS3Success = true;
            uploadedStorageKey = storageKey;
          }
        }
      }
    } catch (presignedErr) {
      console.warn('Direct S3 upload failed, attempting multipart fallback:', presignedErr);
      directS3Success = false;
    }

    // Step 2: Request AI Transcription
    updateStage('transcribing');

    let transcriptionJson: any;

    if (directS3Success && uploadedStorageKey) {
      // Fast path: Backend reads stream directly from S3
      const transRes = await fetch(
        `${API_URL}/care-companion/visits/${visitId}/ai/transcribe-voice`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            storageKey: uploadedStorageKey,
            mimeType,
          }),
          signal: abortControllerRef.current.signal,
        }
      );
      transcriptionJson = await transRes.json();
    } else {
      // Fallback path: Standard multipart upload to backend
      console.log('Executing multipart audio upload fallback...');
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        name: 'visit-note.m4a',
        type: mimeType,
      } as any);

      const transRes = await fetch(
        `${API_URL}/care-companion/visits/${visitId}/ai/transcribe-voice`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
          signal: abortControllerRef.current.signal,
        }
      );
      transcriptionJson = await transRes.json();
    }

    if (transcriptionJson.success && transcriptionJson.data?.transcript) {
      onTranscribed(transcriptionJson.data.transcript);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateStage('idle');
      setLastAudioUri(null);
      setDurationSecs(0);
    } else if (transcriptionJson.data?.transcript === '') {
      updateStage('idle');
      Alert.alert(
        'No Speech Detected',
        'We could not hear any clear voice observations. Please try speaking closer to the mic.'
      );
    } else {
      updateStage('failed');
      Alert.alert(
        'Transcription Failed',
        transcriptionJson.message || 'Could not transcribe voice notes.'
      );
    }
  };

  const handleRetry = () => {
    if (lastAudioUri) {
      uploadAndTranscribe(lastAudioUri);
    }
  };

  // Rendering based on stage
  if (stage === 'uploading') {
    return (
      <View style={styles.statusContainer}>
        <ActivityIndicator size="small" color="#4F46E5" />
        <Text style={styles.statusText}>Uploading audio...</Text>
        <TouchableOpacity style={styles.miniCancelBtn} onPress={cancelRecording}>
          <Ionicons name="close-circle" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    );
  }

  if (stage === 'transcribing') {
    return (
      <View style={styles.statusContainer}>
        <ActivityIndicator size="small" color="#4F46E5" />
        <Text style={styles.statusText}>Transcribing with AI...</Text>
      </View>
    );
  }

  if (stage === 'failed' && lastAudioUri) {
    return (
      <View style={styles.failedContainer}>
        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
          <Ionicons name="reload" size={14} color="#DC2626" style={{ marginRight: 4 }} />
          <Text style={styles.retryBtnText}>Retry Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.discardBtn} onPress={cancelRecording}>
          <Text style={styles.discardBtnText}>Discard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (stage === 'recording') {
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
            onPress={stopAndProcessAudio}
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    color: '#4F46E5',
    marginLeft: 6,
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
  miniCancelBtn: {
    marginLeft: 8,
    padding: 2,
  },
  failedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  retryBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    fontFamily: 'Poppins-Medium',
  },
  discardBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  discardBtnText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
  },
});
