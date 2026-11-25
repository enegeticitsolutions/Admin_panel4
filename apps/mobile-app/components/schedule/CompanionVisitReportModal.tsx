import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import type { ScheduleVisit } from './index';

interface CompanionVisitReportModalProps {
  visible: boolean;
  visit: ScheduleVisit | null;
  onClose: () => void;
}

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  cheerful: '😊',
  neutral: '🙂',
  calm: '😌',
  sad: '😔',
  anxious: '😟',
  depressed: '😔',
};

const shortVitalLabel = (name: string, code?: string) => {
  const c = (code || '').toUpperCase();
  if (c === 'BP' || name.toLowerCase().includes('blood pressure')) return 'BP';
  if (c === 'PULSE' || c === 'HEART_RATE' || name.toLowerCase().includes('pulse') || name.toLowerCase().includes('heart')) return 'Pulse';
  if (c === 'SPO2' || name.toLowerCase().includes('spo2') || name.toLowerCase().includes('oxygen')) return 'SpO₂';
  if (c === 'BLOOD_GLUCOSE' || name.toLowerCase().includes('sugar') || name.toLowerCase().includes('glucose')) return 'Sugar';
  return name;
};

export function CompanionVisitReportModal({
  visible,
  visit,
  onClose,
}: CompanionVisitReportModalProps) {
  const insets = useSafeAreaInsets();

  if (!visit) return null;

  const companionFirst = (visit.companionFirstName || visit.companionName?.split(' ')[0] || 'Companion').toUpperCase();
  const statusTitle = visit.status === 'completed' ? 'Completed' : visit.status === 'cancelled' ? 'Cancelled' : 'Logged';
  const moodKey = (visit.mood || '').toLowerCase();
  const moodEmoji = MOOD_EMOJI[moodKey] || '🙂';

  const vitals = (visit.vitals || []).slice(0, 4);
  const photos = (visit.photos || [])
    .map((url) => sanitizeImageUri(url))
    .filter((u): u is string => Boolean(u));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          {/* Sticky Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Companion visit report</Text>
              <Text style={styles.headerSubtitle}>
                {statusTitle} · {visit.fullDateTime || visit.date}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.8}
              accessibilityLabel="Close visit report"
            >
              <Feather name="x" size={20} color="#4B5563" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(24, insets.bottom + 16) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Status Banner */}
            <View style={styles.statusBanner}>
              <Feather
                name={visit.status === 'cancelled' ? 'x-circle' : 'check'}
                size={19}
                color={visit.status === 'cancelled' ? '#991B1B' : '#176D53'}
              />
              <Text
                style={[
                  styles.statusBannerText,
                  visit.status === 'cancelled' && { color: '#991B1B' },
                ]}
              >
                {visit.status === 'cancelled'
                  ? 'This scheduled visit was cancelled'
                  : 'Visit completed and reviewed by the care team'}
              </Text>
            </View>

            {/* Companion Note */}
            <View style={styles.section}>
              <Text style={styles.noteEyebrow}>{`${companionFirst}'S NOTE`}</Text>
              <Text style={styles.noteText}>
                {visit.visitSummary ||
                  visit.notes ||
                  'No companion notes were recorded for this visit.'}
              </Text>
            </View>

            {/* Vitals Grid */}
            {vitals.length > 0 && (
              <View style={styles.vitalsGrid}>
                {vitals.map((v, idx) => (
                  <View key={v.id || `${v.name}-${idx}`} style={styles.vitalCard}>
                    <Text style={styles.vitalValue} numberOfLines={1}>
                      {v.value}
                    </Text>
                    <Text style={styles.vitalLabel} numberOfLines={1}>
                      {shortVitalLabel(v.name, v.code)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Mood Card */}
            {visit.mood && (
              <View style={styles.moodBox}>
                <Text style={styles.moodTitle}>
                  Mood: {moodEmoji} {visit.mood}
                </Text>
                <Text style={styles.moodSub}>
                  Observed by {visit.companionFirstName || visit.companionName} during the visit.
                </Text>
              </View>
            )}

            {/* Photo Memories */}
            {photos.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.photosTitle}>Photo memories</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.photosRow}
                >
                  {photos.map((uri, i) => (
                    <View key={`${uri}-${i}`} style={styles.photoCard}>
                      <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 41, 55, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    width: '100%',
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '86%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderBottomWidth: 1.08,
    borderBottomColor: '#E7DED6',
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: '#1F2937',
  },
  headerSubtitle: {
    marginTop: 4,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: '#667085',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F1EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 20,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: '#E8F7F1',
    borderRadius: 16,
  },
  statusBannerText: {
    flex: 1,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: '#176D53',
  },
  section: {
    marginTop: 24,
  },
  noteEyebrow: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.44,
    textTransform: 'uppercase',
    color: '#FE6700',
  },
  noteText: {
    marginTop: 12,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 26,
    color: '#444C58',
  },
  vitalsGrid: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 8,
  },
  vitalCard: {
    flex: 1,
    backgroundColor: '#F4FAF7',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalValue: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#176D53',
  },
  vitalLabel: {
    marginTop: 4,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    color: '#667085',
  },
  moodBox: {
    marginTop: 24,
    backgroundColor: '#FFF3D2',
    borderRadius: 16,
    padding: 16,
  },
  moodTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#704B00',
  },
  moodSub: {
    marginTop: 4,
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
    color: '#795F28',
  },
  photosTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#1F2937',
  },
  photosRow: {
    marginTop: 12,
    gap: 8,
  },
  photoCard: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F1EF',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
});
