import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COMMON_MEDICATION_PRESETS, MedicationPresetItem } from '@/constants/medicationPresets';

interface DefaultMedsPresetsProps {
  onSelectPreset: (preset: MedicationPresetItem) => void;
  onQuickAddPreset?: (preset: MedicationPresetItem) => void;
  addingId?: string | null;
}

export const DefaultMedsPresets: React.FC<DefaultMedsPresetsProps> = ({
  onSelectPreset,
  onQuickAddPreset,
  addingId,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Common Presets</Text>
          <Text style={styles.subtitle}>Tap to customize or add with 1-tap</Text>
        </View>
        <Ionicons name="sparkles" size={18} color="#FE6700" />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {COMMON_MEDICATION_PRESETS.map((preset) => {
          const isAdding = addingId === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              activeOpacity={0.85}
              style={styles.card}
              onPress={() => onSelectPreset(preset)}
            >
              <View style={styles.cardTop}>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: preset.badgeColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      { color: preset.badgeTextColor },
                    ]}
                  >
                    {preset.category}
                  </Text>
                </View>
                <View style={styles.iconCircle}>
                  <Ionicons
                    name={(preset.iconName as any) || 'medkit-outline'}
                    size={16}
                    color="#FE6700"
                  />
                </View>
              </View>

              <Text style={styles.medName} numberOfLines={1}>
                {preset.name}
              </Text>
              <Text style={styles.dosageText}>{preset.dosage} • {preset.route}</Text>

              <View style={styles.timingRow}>
                <Ionicons name="time-outline" size={12} color="#6B7280" />
                <Text style={styles.timingText} numberOfLines={1}>
                  {preset.frequency.replace('_', ' ')} ({preset.timeSlots.join(', ')})
                </Text>
              </View>

              <Text style={styles.instructionsText} numberOfLines={1}>
                {preset.instructions}
              </Text>

              <View style={styles.cardActionRow}>
                <TouchableOpacity
                  style={[styles.quickAddBtn, isAdding && styles.quickAddBtnDisabled]}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (onQuickAddPreset) {
                      onQuickAddPreset(preset);
                    } else {
                      onSelectPreset(preset);
                    }
                  }}
                  disabled={isAdding}
                >
                  <Ionicons
                    name={isAdding ? 'hourglass-outline' : 'add'}
                    size={14}
                    color="#FFFFFF"
                  />
                  <Text style={styles.quickAddBtnText}>
                    {isAdding ? 'Adding...' : '1-Tap Add'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.customizeBtn}
                  onPress={() => onSelectPreset(preset)}
                >
                  <Text style={styles.customizeBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  scrollContent: {
    gap: 12,
    paddingRight: 16,
    paddingVertical: 2,
  },
  card: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  dosageText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
    marginBottom: 6,
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  timingText: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'capitalize',
    flex: 1,
  },
  instructionsText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
  },
  quickAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FE6700',
    paddingVertical: 7,
    borderRadius: 8,
  },
  quickAddBtnDisabled: {
    opacity: 0.6,
  },
  quickAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  customizeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  customizeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
});

