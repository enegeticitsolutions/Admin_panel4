import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MedicationPresetItem } from '@/constants/medicationPresets';

export interface MedicationFormPayload {
  id?: string;
  name: string;
  genericName?: string;
  dosage: string;
  route: string;
  frequency: string;
  timeSlots: string[];
  instructions?: string;
  startDate?: string;
  endDate?: string | null;
  totalDays?: number | null;
  setReminders: boolean;
}

interface AddMedicationModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: MedicationFormPayload) => Promise<void> | void;
  initialPreset?: MedicationPresetItem | null;
  initialData?: MedicationFormPayload | null;
  loading?: boolean;
}

const FREQUENCY_OPTIONS = [
  { label: 'Once daily', value: 'once_daily', slots: ['08:00 AM'] },
  { label: 'Twice daily', value: 'twice_daily', slots: ['08:00 AM', '08:00 PM'] },
  { label: 'Thrice daily', value: 'thrice_daily', slots: ['08:00 AM', '02:00 PM', '08:00 PM'] },
  { label: '4x daily', value: 'four_times_daily', slots: ['08:00 AM', '01:00 PM', '06:00 PM', '10:00 PM'] },
  { label: 'As needed', value: 'as_needed', slots: ['08:00 AM'] },
];

const ROUTE_OPTIONS = [
  { label: 'Oral', value: 'oral' },
  { label: 'Sublingual', value: 'sublingual' },
  { label: 'Topical', value: 'topical' },
  { label: 'Inhaled', value: 'inhaled' },
  { label: 'Injectable', value: 'injectable' },
];

const QUICK_INSTRUCTIONS = [
  'Before breakfast',
  'After breakfast',
  'With meals',
  'After meals',
  'Empty stomach',
  'At bedtime',
];

const TIME_PRESET_SLOTS = [
  '07:30 AM',
  '08:00 AM',
  '09:00 AM',
  '01:30 PM',
  '06:00 PM',
  '08:00 PM',
  '09:30 PM',
  '10:00 PM',
];

export const AddMedicationModal: React.FC<AddMedicationModalProps> = ({
  visible,
  onClose,
  onSave,
  initialPreset,
  initialData,
  loading = false,
}) => {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('oral');
  const [frequency, setFrequency] = useState('once_daily');
  const [timeSlots, setTimeSlots] = useState<string[]>(['08:00 AM']);
  const [instructions, setInstructions] = useState('');
  const [totalDays, setTotalDays] = useState<number | null>(null);
  const [setReminders, setSetReminders] = useState(true);

  // Sync state when modal opens or initial data/preset changes
  useEffect(() => {
    if (!visible) return;

    if (initialPreset) {
      setName(initialPreset.name);
      setDosage(initialPreset.dosage);
      setRoute(initialPreset.route || 'oral');
      setFrequency(initialPreset.frequency || 'once_daily');
      setTimeSlots(initialPreset.timeSlots || ['08:00 AM']);
      setInstructions(initialPreset.instructions || '');
      setTotalDays(null);
      setSetReminders(true);
    } else if (initialData) {
      setName(initialData.name || '');
      setDosage(initialData.dosage || '');
      setRoute(initialData.route || 'oral');
      setFrequency(initialData.frequency || 'once_daily');
      setTimeSlots(initialData.timeSlots || ['08:00 AM']);
      setInstructions(initialData.instructions || '');
      setTotalDays(initialData.totalDays ?? null);
      setSetReminders(initialData.setReminders ?? true);
    } else {
      setName('');
      setDosage('');
      setRoute('oral');
      setFrequency('once_daily');
      setTimeSlots(['08:00 AM']);
      setInstructions('');
      setTotalDays(null);
      setSetReminders(true);
    }
  }, [visible, initialPreset, initialData]);

  const handleFrequencySelect = (val: string) => {
    setFrequency(val);
    const opt = FREQUENCY_OPTIONS.find((f) => f.value === val);
    if (opt) {
      setTimeSlots(opt.slots);
    }
  };

  const toggleTimeSlot = (slot: string) => {
    if (timeSlots.includes(slot)) {
      if (timeSlots.length <= 1) {
        Alert.alert('Required', 'At least one time slot is required.');
        return;
      }
      setTimeSlots(timeSlots.filter((s) => s !== slot));
    } else {
      setTimeSlots([...timeSlots, slot]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter the medication name.');
      return;
    }
    if (!dosage.trim()) {
      Alert.alert('Required', 'Please enter the dosage (e.g. 500mg, 1 tablet).');
      return;
    }
    if (timeSlots.length === 0) {
      Alert.alert('Required', 'Please select at least one time slot.');
      return;
    }

    await onSave({
      id: initialData?.id,
      name: name.trim(),
      dosage: dosage.trim(),
      route,
      frequency,
      timeSlots,
      instructions: instructions.trim(),
      totalDays,
      setReminders,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContent}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>
                {initialPreset
                  ? `Add ${initialPreset.name}`
                  : initialData
                  ? 'Edit Medication'
                  : 'Add Medication'}
              </Text>
              <Text style={styles.headerSubtitle}>
                Schedule medication dose and reminders
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#4B5563" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollArea}>
            {/* Medication Name */}
            <Text style={styles.fieldLabel}>Medication Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Metformin, Amlodipine, Pan-40"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />

            {/* Dosage & Route */}
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>Dosage *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 500mg, 1 tab"
                  placeholderTextColor="#9CA3AF"
                  value={dosage}
                  onChangeText={setDosage}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.fieldLabel}>Route</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
                  {ROUTE_OPTIONS.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[
                        styles.chip,
                        route === r.value ? styles.chipActive : styles.chipInactive,
                      ]}
                      onPress={() => setRoute(r.value)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          route === r.value ? styles.chipTextActive : styles.chipTextInactive,
                        ]}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Frequency */}
            <Text style={styles.fieldLabel}>Frequency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {FREQUENCY_OPTIONS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  style={[
                    styles.chip,
                    frequency === f.value ? styles.chipActive : styles.chipInactive,
                  ]}
                  onPress={() => handleFrequencySelect(f.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      frequency === f.value ? styles.chipTextActive : styles.chipTextInactive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Time Slots */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.fieldLabel}>Time Slots ({timeSlots.length})</Text>
              <Text style={styles.fieldSubHint}>Tap to toggle</Text>
            </View>
            <View style={styles.timeSlotsWrap}>
              {TIME_PRESET_SLOTS.map((slot) => {
                const isSelected = timeSlots.includes(slot);
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[
                      styles.slotChip,
                      isSelected ? styles.slotChipSelected : styles.slotChipUnselected,
                    ]}
                    onPress={() => toggleTimeSlot(slot)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'time-outline'}
                      size={14}
                      color={isSelected ? '#FE6700' : '#6B7280'}
                    />
                    <Text
                      style={[
                        styles.slotText,
                        isSelected ? styles.slotTextSelected : styles.slotTextUnselected,
                      ]}
                    >
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Meal & Schedule Instructions */}
            <Text style={styles.fieldLabel}>Instructions</Text>
            <View style={styles.quickChipsWrap}>
              {QUICK_INSTRUCTIONS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.quickInstChip,
                    instructions.includes(item) && styles.quickInstChipActive,
                  ]}
                  onPress={() => {
                    if (instructions.includes(item)) {
                      setInstructions(instructions.replace(item, '').trim());
                    } else {
                      setInstructions(instructions ? `${instructions}, ${item}` : item);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.quickInstText,
                      instructions.includes(item) && styles.quickInstTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { minHeight: 44 }]}
              placeholder="e.g. After breakfast for Blood Pressure"
              placeholderTextColor="#9CA3AF"
              value={instructions}
              onChangeText={setInstructions}
            />

            {/* Duration */}
            <Text style={styles.fieldLabel}>Course Duration</Text>
            <View style={styles.chipsScroll}>
              {[
                { label: 'Ongoing', days: null },
                { label: '7 Days', days: 7 },
                { label: '14 Days', days: 14 },
                { label: '30 Days', days: 30 },
                { label: '90 Days', days: 90 },
              ].map((d) => (
                <TouchableOpacity
                  key={d.label}
                  style={[
                    styles.chip,
                    totalDays === d.days ? styles.chipActive : styles.chipInactive,
                  ]}
                  onPress={() => setTotalDays(d.days)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      totalDays === d.days ? styles.chipTextActive : styles.chipTextInactive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reminders Toggle Switch */}
            <View style={styles.reminderCard}>
              <View style={styles.reminderLeft}>
                <View style={styles.bellIconBg}>
                  <Ionicons name="notifications" size={18} color="#FE6700" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reminderTitle}>Schedule Reminders</Text>
                  <Text style={styles.reminderSubtitle}>
                    Get notifications at every scheduled dose time
                  </Text>
                </View>
              </View>
              <Switch
                value={setReminders}
                onValueChange={setSetReminders}
                trackColor={{ false: '#E5E7EB', true: '#FED7AA' }}
                thumbColor={setReminders ? '#FE6700' : '#9CA3AF'}
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>
                    {initialData ? 'Save Changes' : 'Add Medication'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    paddingBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 10,
  },
  fieldSubHint: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#FE6700',
  },
  chipInactive: {
    backgroundColor: '#F3F4F6',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: '#4B5563',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  timeSlotsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  slotChipSelected: {
    borderColor: '#FE6700',
    backgroundColor: '#FFF7ED',
  },
  slotChipUnselected: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  slotText: {
    fontSize: 12,
    fontWeight: '600',
  },
  slotTextSelected: {
    color: '#FE6700',
  },
  slotTextUnselected: {
    color: '#4B5563',
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  quickInstChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickInstChipActive: {
    backgroundColor: '#FFEDD5',
    borderColor: '#FDBA74',
  },
  quickInstText: {
    fontSize: 11,
    color: '#4B5563',
  },
  quickInstTextActive: {
    color: '#C2410C',
    fontWeight: '600',
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reminderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  bellIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  reminderSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FE6700',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

