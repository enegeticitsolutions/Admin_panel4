import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Dimensions, Modal, Switch, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

import GlobalDrawer from '../(subscriber)/components/shared/GlobalDrawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import HeaderSpacer from '@/components/HeaderSpacer';
import { AddMedicineModal } from '@/components/ui/AddMedicineModal';

type Medication = {
    name: string;
    dosage: string;
    frequency: string;
    timesPerDay: string[];
    setReminders: boolean;
    totalDays?: string;
    instructions?: string;
    startDate?: string;
    endDate?: string;
};

export default function MedicalInfoScreen() {
    const router = useRouter();
    const { push } = useNavigationStack();
    const safeBack = useSafeBack();
    useAndroidBackHandler();
    const params = useLocalSearchParams();

    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        AsyncStorage.getItem('userData').then(data => {
            if (data) setUserData(JSON.parse(data));
        });
    }, []);

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    };
    const closeDrawer = () => {
        Animated.timing(drawerAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: true }).start(() => setDrawerOpen(false));
    };

    // Core Data States
    const [conditions, setConditions] = useState<string[]>([]);
    const [medications, setMedications] = useState<Medication[]>([]);
    const [physicianName, setPhysicianName] = useState('');
    const [physicianPhone, setPhysicianPhone] = useState('');
    const [hobbiesText, setHobbiesText] = useState(''); // comma separated for now
    const [customHobbyText, setCustomHobbyText] = useState('');
    const [vitals, setVitals] = useState<Record<string, boolean>>({});
    
    // Config States
    const [vitalsConfig, setVitalsConfig] = useState<any[]>([]);
    const [loadingVitals, setLoadingVitals] = useState(true);

    // Modal States
    const [showConditionModal, setShowConditionModal] = useState(false);
    const [showHobbiesModal, setShowHobbiesModal] = useState(false);
    const [availableHobbies, setAvailableHobbies] = useState<string[]>([
        'Reading', 'Gardening', 'Traveling', 'Music', 'Cooking', 
        'Photography', 'Yoga/Exercise', 'Painting/Sketching', 
        'Socializing', 'Movies/TV', 'Playing Cards/Board Games', 'Other'
    ]);
    const [newCondition, setNewCondition] = useState('');

    const [showMedicineModal, setShowMedicineModal] = useState(false);
    const getTodayFormatted = () => {
        const d = new Date();
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const formatEditingDate = (text: string) => {
        const clean = text.replace(/[^0-9]/g, '');
        if (clean.length <= 2) return clean;
        if (clean.length <= 4) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
        return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 8)}`;
    };

    const [newMedicine, setNewMedicine] = useState<Medication>({
        name: '',
        dosage: '',
        frequency: 'once_daily',
        timesPerDay: [],
        setReminders: false,
        instructions: '',
        startDate: getTodayFormatted(),
        endDate: ''
    });
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const isVerificationFlow = params.isVerificationFlow === 'true';
    const beneficiaryId = params.beneficiaryId as string;
    const pendingDetailsRaw = params.pendingDetails as string;

    const [isStartDatePickerVisible, setStartDatePickerVisibility] = useState(false);
    const [isEndDatePickerVisible, setEndDatePickerVisibility] = useState(false);

    const handleConfirmStartDate = (date: Date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        setNewMedicine({ ...newMedicine, startDate: `${day}-${month}-${year}` });
        setStartDatePickerVisibility(false);
    };

    const handleConfirmEndDate = (date: Date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        setNewMedicine({ ...newMedicine, endDate: `${day}-${month}-${year}` });
        setEndDatePickerVisibility(false);
    };

    useEffect(() => {
        const fetchVitals = async () => {
            try {
                const res = await fetch(`${API_URL}/public/vitals?activeOnly=true`);
                const data = await res.json();
                if (data.success && data.data) {
                    setVitalsConfig(data.data);
                    const initial: Record<string, boolean> = {};
                    
                    // By default, system vitals are pre-checked
                    data.data.forEach((v: any) => {
                        initial[v.code] = !!v.isSystemVital;
                    });

                    // Pre-fill active vitals in verification flow if saved configs exist
                    if (isVerificationFlow && pendingDetailsRaw) {
                        try {
                            const b = JSON.parse(pendingDetailsRaw);
                            if (b.vitalConfigs && Array.isArray(b.vitalConfigs) && b.vitalConfigs.length > 0) {
                                // Reset to false first so we accurately reflect the saved configuration
                                data.data.forEach((v: any) => {
                                    initial[v.code] = false;
                                });
                                b.vitalConfigs.forEach((vc: any) => {
                                    const code = vc.vitalDefinition?.code || vc.code;
                                    if (code) {
                                        initial[code] = vc.isActive !== false;
                                    }
                                });
                            }
                        } catch (err) {
                            console.error('Error pre-filling vitals configuration:', err);
                        }
                    }

                    setVitals(initial);
                }
            } catch (err) {
                console.error('Failed to fetch vitals', err);
            } finally {
                setLoadingVitals(false);
            }
        };

        fetchVitals();

        const fetchHobbies = async () => {
            try {
                const res = await fetch(`${API_URL}/public/hobbies?activeOnly=true`);
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    const names = data.data.map((h: any) => h.name);
                    const hasOther = names.includes('Other');
                    const sorted = [...names.filter((n: string) => n !== 'Other')];
                    if (hasOther) sorted.push('Other');
                    setAvailableHobbies(sorted);
                }
            } catch (err) {
                console.error('Failed to fetch hobbies', err);
            }
        };

        fetchHobbies();

        // Pre-fill conditions, medications, physician details, and hobbies in verification flow
        if (isVerificationFlow && pendingDetailsRaw) {
            try {
                const b = JSON.parse(pendingDetailsRaw);
                if (b.conditions && Array.isArray(b.conditions)) {
                    setConditions(b.conditions.map((c: any) => c.condition?.name).filter(Boolean));
                }
                if (b.medicationList && Array.isArray(b.medicationList)) {
                    setMedications(b.medicationList.map((m: any) => {
                        let formattedStart = '';
                        if (m.startDate) {
                            const d = new Date(m.startDate);
                            const day = d.getDate().toString().padStart(2, '0');
                            const month = (d.getMonth() + 1).toString().padStart(2, '0');
                            const year = d.getFullYear();
                            formattedStart = `${day}-${month}-${year}`;
                        } else {
                            formattedStart = getTodayFormatted();
                        }
                        let formattedEnd = '';
                        if (m.endDate) {
                            const d = new Date(m.endDate);
                            const day = d.getDate().toString().padStart(2, '0');
                            const month = (d.getMonth() + 1).toString().padStart(2, '0');
                            const year = d.getFullYear();
                            formattedEnd = `${day}-${month}-${year}`;
                        }
                        return {
                            name: m.name || '',
                            dosage: m.dosage || '',
                            frequency: m.frequency || 'once_daily',
                            timesPerDay: m.timeSlots || [],
                            setReminders: !!m.setReminders,
                            instructions: m.instructions || '',
                            startDate: formattedStart,
                            endDate: formattedEnd
                        };
                    }));
                }
                if (b.primaryPhysicianName) setPhysicianName(b.primaryPhysicianName);
                if (b.primaryPhysicianPhone) setPhysicianPhone(b.primaryPhysicianPhone);
                if (b.hobbiesInterests && Array.isArray(b.hobbiesInterests)) {
                    setHobbiesText(b.hobbiesInterests.join(', '));
                    const otherVal = b.hobbiesInterests.find((h: any) => typeof h === 'string' && h.startsWith('(') && h.endsWith(')'));
                    if (otherVal) {
                        setCustomHobbyText(otherVal.slice(1, -1));
                    }
                }
            } catch (err) {
                console.error('Error parsing pending details in medical-info:', err);
            }
        }
    }, [isVerificationFlow, pendingDetailsRaw]);

    const handleNext = () => {
        const medicalDataPayload = {
            conditions,
            medications,
            physicianName,
            physicianPhone,
            hobbies: hobbiesText.split(',').map(s => s.trim()).filter(Boolean),
            vitals
        };

        push('/(setup)/emergency-contacts', {
            packageId: params.packageId,
            subscriberData: params.subscriberData,
            beneficiaryData: params.beneficiaryData,
            medicalData: JSON.stringify(medicalDataPayload),
            isVerificationFlow: params.isVerificationFlow,
            beneficiaryId: params.beneficiaryId,
            pendingDetails: params.pendingDetails,
            isLinkingFlow: params.isLinkingFlow || 'false'
        });
    };

    const handleBack = () => {
        safeBack();
    };

    const addCondition = () => {
        if (newCondition.trim().length > 0) {
            setConditions([...conditions, newCondition.trim()]);
        }
        setNewCondition('');
        setShowConditionModal(false);
    };

    const removeCondition = (index: number) => {
        setConditions(conditions.filter((_, i) => i !== index));
    };

    const editMedicine = (index: number) => {
        const med = medications[index];
        setNewMedicine({
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            timesPerDay: med.timesPerDay,
            setReminders: med.setReminders,
            totalDays: med.totalDays || '',
            instructions: med.instructions || ''
        });
        setEditingIndex(index);
        setShowMedicineModal(true);
    };

    const addMedicine = () => {
        if (newMedicine.name.trim().length > 0) {
            if (editingIndex !== null) {
                const updated = [...medications];
                updated[editingIndex] = newMedicine;
                setMedications(updated);
            } else {
                setMedications([...medications, newMedicine]);
            }
        }
        setNewMedicine({ name: '', dosage: '', frequency: 'once_daily', timesPerDay: [], setReminders: false, instructions: '', startDate: getTodayFormatted(), endDate: '' });
        setEditingIndex(null);
        setShowMedicineModal(false);
    };

    const cancelModal = () => {
        setNewMedicine({ name: '', dosage: '', frequency: 'once_daily', timesPerDay: [], setReminders: false, instructions: '', startDate: getTodayFormatted(), endDate: '' });
        setEditingIndex(null);
        setShowMedicineModal(false);
    };

    const removeMedicine = (index: number) => {
        setMedications(medications.filter((_, i) => i !== index));
        if (editingIndex === index) {
            setEditingIndex(null);
        }
    };

    const toggleTimeSlot = (slot: string) => {
        const times = newMedicine.timesPerDay;
        const freq = newMedicine.frequency;
        
        let maxSlots = 3;
        if (freq === 'once_daily') maxSlots = 1;
        else if (freq === 'twice_daily') maxSlots = 2;

        if (times.includes(slot)) {
            setNewMedicine({ ...newMedicine, timesPerDay: times.filter(t => t !== slot) });
        } else {
            if (times.length >= maxSlots) {
                if (maxSlots === 1) {
                    setNewMedicine({ ...newMedicine, timesPerDay: [slot] });
                } else {
                    setNewMedicine({ ...newMedicine, timesPerDay: [...times.slice(1), slot] });
                }
            } else {
                setNewMedicine({ ...newMedicine, timesPerDay: [...times, slot] });
            }
        }
    };

    const toggleHobby = (hobby: string) => {
        const currentHobbies = hobbiesText ? hobbiesText.split(', ').filter(Boolean) : [];
        let updatedHobbies;
        if (currentHobbies.includes(hobby)) {
            updatedHobbies = currentHobbies.filter(h => h !== hobby);
            if (hobby === 'Other') {
                updatedHobbies = updatedHobbies.filter(h => !h.startsWith('('));
                setCustomHobbyText('');
            }
        } else {
            updatedHobbies = [...currentHobbies, hobby];
        }
        setHobbiesText(updatedHobbies.join(', '));
    };

    const formatFrequency = (frequency: string) => {
        const labels: Record<string, string> = {
            once_daily: 'Once Daily',
            twice_daily: 'Twice Daily',
            thrice_daily: 'Thrice Daily'
        };
        return labels[frequency] || frequency;
    };

    const Checkbox = ({ label, checked, onPress }: { label: string, checked: boolean, onPress: () => void }) => (
        <TouchableOpacity style={styles.checkboxContainer} onPress={onPress}>
            <View style={[styles.checkboxBox, checked && styles.checkboxChecked]}>
                {checked && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </View>
            <Text style={styles.checkboxLabel}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.safeArea}>
            <HeaderSpacer backgroundColor="#FFFFFF" />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                
                {/* Fixed Header aligned to design */}
                <View style={styles.headerContainer}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={handleBack} style={styles.headerIconBtn}>
                            <Ionicons name="arrow-back" size={24} color="#111827" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleBox}>
                            <Text style={styles.headerTitle}>Subscribe to Care</Text>
                            <Text style={styles.headerSubtitle}>Step 3 of 5</Text>
                        </View>
                        <View style={styles.headerRightIcons}>
                            <View>
                                <Ionicons name="notifications-outline" size={26} color="#111827" />
                                <View style={styles.badge}><Text style={styles.badgeText}>2</Text></View>
                            </View>
                            <TouchableOpacity onPress={openDrawer}>
                                <Ionicons name="menu-outline" size={28} color="#111827" style={{ marginLeft: 16 }} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: '60%' }]} />
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Medical Information Panel */}
                    <View style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.sectionTitle}>Medical Information</Text>
                            <TouchableOpacity style={styles.addBtnCircle} onPress={() => setShowConditionModal(true)}>
                                <Ionicons name="add" size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {conditions.length === 0 ? (
                            <Text style={styles.emptyText}>No conditions added.</Text>
                        ) : (
                            conditions.map((item, index) => (
                                <View key={index} style={styles.conditionTag}>
                                    <Text style={styles.conditionText}>{item}</Text>
                                    <TouchableOpacity onPress={() => removeCondition(index)}>
                                        <Ionicons name="close" size={18} color="#A855F7" />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>

                    {/* Current Medications Panel */}
                    <View style={styles.card}>
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.sectionTitle}>Current Medications</Text>
                            <TouchableOpacity style={styles.addBtnCircle} onPress={() => setShowMedicineModal(true)}>
                                <Ionicons name="add" size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {medications.length === 0 ? (
                            <Text style={styles.emptyText}>No medications added.</Text>
                        ) : (
                            medications.map((med, index) => (
                                <TouchableOpacity 
                                    key={index} 
                                    style={styles.medicineCard}
                                    activeOpacity={0.7}
                                    onPress={() => editMedicine(index)}
                                >
                                    <View style={styles.medicineInfo}>
                                        <Text style={styles.medicineName}>{med.name}</Text>
                                        <Text style={styles.medicineSub}>{med.dosage} • {formatFrequency(med.frequency)}</Text>
                                        <Text style={[styles.medicineSub, { fontSize: 11, color: '#4B5563', marginTop: 1 }]}>
                                            Duration: {med.startDate || 'Today'}{med.endDate ? ` to ${med.endDate}` : ' (Ongoing)'}
                                        </Text>
                                        {!!med.instructions && (
                                            <Text style={[styles.medicineSub, { color: '#6B7280', fontSize: 11, marginTop: 3 }]}>{med.instructions}</Text>
                                        )}
                                    </View>
                                    <View style={styles.medicineRight}>
                                        {/* Shows the first selected time as pill, if any */}
                                        {med.timesPerDay.length > 0 && (
                                            <View style={styles.timePill}>
                                                <Text style={styles.timePillText}>{med.timesPerDay[0]}</Text>
                                            </View>
                                        )}
                                        <TouchableOpacity onPress={() => removeMedicine(index)} style={{ marginLeft: 8 }}>
                                            <Ionicons name="close" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>

                    {/* Large Unified Form Block */}
                    <View style={styles.card}>
                        
                        <Text style={styles.subHeading}>Vitals to Track During Home Visits</Text>
                        {loadingVitals ? (
                            <ActivityIndicator size="small" color="#F97316" style={{ alignSelf: 'flex-start', marginVertical: 10 }} />
                        ) : vitalsConfig.map((v) => (
                            <Checkbox 
                                key={v.id} 
                                label={v.name + (v.unit ? ` (${v.unit})` : '')} 
                                checked={!!vitals[v.code]} 
                                onPress={() => setVitals({ ...vitals, [v.code]: !vitals[v.code] })} 
                            />
                        ))}

                        <View style={{ marginTop: 24 }} />

                        <Text style={styles.inputLabel}>Primary Physician Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Dr. Name"
                            placeholderTextColor="#9CA3AF"
                            value={physicianName}
                            maxLength={50}
                            onChangeText={setPhysicianName}
                        />

                        <View style={{ marginTop: 16 }} />

                        <Text style={styles.inputLabel}>Physician Phone Number</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Contact number"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            maxLength={10}
                            value={physicianPhone}
                            onChangeText={(t) => setPhysicianPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                        />

                        <View style={{ marginTop: 16 }} />

                        <Text style={styles.inputLabel}>Hobbies & Interests</Text>
                        <TouchableOpacity 
                            style={styles.dropdownInputBox}
                            onPress={() => setShowHobbiesModal(true)}
                        >
                            <Text 
                                style={[styles.dropdownInput, !hobbiesText && { color: '#9CA3AF' }]}
                                numberOfLines={1}
                            >
                                {hobbiesText || "Please Select"}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color="#9CA3AF" style={{ paddingRight: 10 }} />
                        </TouchableOpacity>

                        {/* Custom Hobbies input for 'Other' */}
                        {hobbiesText.split(', ').includes('Other') && (
                            <View style={{ marginTop: 16 }}>
                                <Text style={styles.inputLabel}>Specify Other Hobbies *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Swimming, Bird Watching"
                                    placeholderTextColor="#9CA3AF"
                                    maxLength={50}
                                    value={customHobbyText}
                                    onChangeText={(t) => {
                                        setCustomHobbyText(t);
                                        const baseHobbies = hobbiesText.split(', ').filter(h => h !== 'Other' && !h.startsWith('('));
                                        const trimmed = t.slice(0, 50).trim();
                                        if (trimmed) {
                                            setHobbiesText([...baseHobbies, 'Other', `(${trimmed})`].join(', '));
                                        } else {
                                            setHobbiesText([...baseHobbies, 'Other'].join(', '));
                                        }
                                    }}
                                />
                            </View>
                        )}
                        <Text style={styles.hintText}>This helps us create meaningful social connections</Text>
                        
                        <View style={styles.dividerLine} />

                        {/* Navigation Buttons inside the card as per design */}
                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity style={styles.outlineBtn} onPress={handleBack}>
                                <Text style={styles.outlineBtnText}>Previous</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.solidBtn} onPress={handleNext}>
                                <Text style={styles.solidBtnText}>Next</Text>
                            </TouchableOpacity>
                        </View>

                    </View>

                </ScrollView>

            </KeyboardAvoidingView>

            {/* Modal: Add Medical Condition */}
            <Modal visible={showConditionModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Medical Information</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g., Hypertension, Diabetes"
                            placeholderTextColor="#9CA3AF"
                            value={newCondition}
                            maxLength={50}
                            onChangeText={setNewCondition}
                            autoFocus
                        />
                        <TouchableOpacity style={styles.modalPrimaryBtn} onPress={addCondition}>
                            <Text style={styles.modalPrimaryBtnText}>Add Condition</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => setShowConditionModal(false)}>
                            <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Modal: Add Medicine */}
            <AddMedicineModal
                visible={showMedicineModal}
                onClose={cancelModal}
                onSave={async (medData) => {
                    if (editingIndex !== null) {
                        const updated = [...medications];
                        updated[editingIndex] = {
                            name: medData.name,
                            dosage: medData.dosage,
                            frequency: medData.frequency,
                            instructions: medData.instructions || '',
                            startDate: medData.startDate || getTodayFormatted(),
                            endDate: medData.endDate || '',
                            timesPerDay: medData.timesPerDay || [],
                            setReminders: !!medData.setReminders
                        };
                        setMedications(updated);
                    } else {
                        setMedications([...medications, {
                            name: medData.name,
                            dosage: medData.dosage,
                            frequency: medData.frequency,
                            instructions: medData.instructions || '',
                            startDate: medData.startDate || getTodayFormatted(),
                            endDate: medData.endDate || '',
                            timesPerDay: medData.timesPerDay || [],
                            setReminders: !!medData.setReminders
                        }]);
                    }
                    setShowMedicineModal(false);
                    setEditingIndex(null);
                }}
                initialData={editingIndex !== null ? medications[editingIndex] : null}
            />

            <DateTimePickerModal
                isVisible={isStartDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmStartDate}
                onCancel={() => setStartDatePickerVisibility(false)}
            />

            <DateTimePickerModal
                isVisible={isEndDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmEndDate}
                onCancel={() => setEndDatePickerVisibility(false)}
            />

            {/* Modal: Multi-select Hobbies */}
            <Modal visible={showHobbiesModal} transparent animationType="slide">
                <Pressable style={styles.hobbiesModalOverlay} onPress={() => setShowHobbiesModal(false)}>
                    <View style={styles.hobbiesModalContent}>
                        <View style={styles.hobbiesModalHeader}>
                            <Text style={styles.modalTitle}>Interests & Hobbies</Text>
                            <TouchableOpacity onPress={() => setShowHobbiesModal(false)}>
                                <Ionicons name="close" size={24} color="#111827" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.hobbiesSubtitle}>Select all that apply</Text>
                        <ScrollView contentContainerStyle={styles.hobbiesGrid}>
                            {availableHobbies.map((hobby) => {
                                const isSelected = hobbiesText.split(', ').includes(hobby);
                                return (
                                    <TouchableOpacity 
                                        key={hobby} 
                                        style={[styles.hobbyItem, isSelected && styles.hobbyItemSelected]}
                                        onPress={() => toggleHobby(hobby)}
                                    >
                                        <Text style={[styles.hobbyItemText, isSelected && styles.hobbyItemTextSelected]}>
                                            {hobby}
                                        </Text>
                                        {isSelected && <Ionicons name="checkmark-circle" size={16} color="#F97316" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <TouchableOpacity 
                            style={styles.modalPrimaryBtn} 
                            onPress={() => setShowHobbiesModal(false)}
                        >
                            <Text style={styles.modalPrimaryBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            <GlobalDrawer 
                isOpen={drawerOpen} 
                onClose={closeDrawer} 
                drawerAnim={drawerAnim} 
                userData={userData} 
            />
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFF1E6' },
    
    // Header
    headerContainer: { backgroundColor: '#FFFFFF' },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 11 },
    headerIconBtn: { width: 44, height: 44, justifyContent: 'center' },
    headerTitleBox: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 7 },
    headerTitle: { fontSize: 16, lineHeight: 22, fontWeight: '400', color: '#111827' },
    headerSubtitle: { fontSize: 15, lineHeight: 20, color: '#8F95A3', marginTop: 2 },
    headerRightIcons: { flexDirection: 'row', alignItems: 'center' },
    badge: { position: 'absolute', right: -7, top: -7, backgroundColor: '#FF5C00', borderRadius: 10, width: 19, height: 19, justifyContent: 'center', alignItems: 'center' },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    progressTrack: { height: 3, backgroundColor: '#E5E7EB', width: '100%' },
    progressFill: { height: 3, backgroundColor: '#FF5C00', width: '60%' },
    
    scrollContent: { paddingHorizontal: 21, paddingTop: 31, paddingBottom: 40 },

    // Card Components
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 17,
        marginBottom: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
        elevation: 3
    },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '400', color: '#111827' },
    addBtnCircle: { width: 33, height: 33, borderRadius: 17, backgroundColor: '#FF5C00', justifyContent: 'center', alignItems: 'center' },
    
    // Conditions Panel
    conditionTag: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8F0FF', paddingHorizontal: 12, height: 48, borderRadius: 13, marginBottom: 9 },
    conditionText: { fontSize: 16, color: '#2D2D35', fontWeight: '400' },
    
    // Medications Panel
    medicineCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF1F1', paddingHorizontal: 21, minHeight: 72, borderRadius: 12, marginBottom: 1 },
    medicineInfo: { flex: 1 },
    medicineName: { fontSize: 16, lineHeight: 20, fontWeight: '400', color: '#2D2D35', marginBottom: 3 },
    medicineSub: { fontSize: 12, lineHeight: 16, color: '#2D2D35' },
    medicineRight: { flexDirection: 'row', alignItems: 'center' },
    timePill: { backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 6, borderRadius: 13 },
    timePillText: { fontSize: 12, color: '#374151', fontWeight: '400' },

    emptyText: { fontSize: 16, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4, marginBottom: 9 },

    // Vitals Form & Checkboxes
    subHeading: { fontSize: 16, lineHeight: 20, fontWeight: '400', color: '#111827', marginTop: 6, marginBottom: 12, paddingHorizontal: 8 },
    checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 8 },
    checkboxBox: { width: 17, height: 17, borderWidth: 1.2, borderColor: '#111827', borderRadius: 3, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
    checkboxChecked: { backgroundColor: '#FF5C00', borderColor: '#FF5C00' },
    checkboxLabel: { flex: 1, fontSize: 16, lineHeight: 21, color: '#111827' },

    // Input Fields
    inputLabel: { fontSize: 16, lineHeight: 20, fontWeight: '400', color: '#111827', marginBottom: 10, paddingHorizontal: 8 },
    input: { height: 51, borderWidth: 1, borderColor: '#D7DCE3', borderRadius: 9, paddingHorizontal: 15, paddingVertical: 0, fontSize: 16, color: '#111827', marginHorizontal: 8 },
    dropdownInputBox: { height: 49, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D7DCE3', borderRadius: 9, marginHorizontal: 8 },
    dropdownInput: { flex: 1, paddingHorizontal: 18, fontSize: 16, color: '#111827' },
    hintText: { fontSize: 12, color: '#6B7280', marginTop: 35, paddingHorizontal: 8 },

    dividerLine: { height: 1, backgroundColor: '#E8E8E8', marginTop: 29, marginBottom: 12, marginHorizontal: 8 },

    // Action Buttons
    actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 7, paddingTop: 1 },
    outlineBtn: { flex: 0.48, height: 50, borderWidth: 1, borderColor: '#FF5C00', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    outlineBtnText: { color: '#FF5C00', fontSize: 18, fontWeight: '600' },
    solidBtn: { flex: 0.48, height: 50, backgroundColor: '#FF5C00', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    solidBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },

    // Modals Base
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
    modalMedicineContent: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 20 },
    modalInput: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, padding: 14, fontSize: 15, color: '#111827', marginBottom: 20 },
    
    // Modal Helpers
    splitRow: { flexDirection: 'row', justifyContent: 'space-between' },
    splitRowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    inputLabelSm: { fontSize: 13, color: '#374151', marginBottom: 8 },
    dropdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14 },
    timesCountText: { fontSize: 13, color: '#111827', fontWeight: '500' },
    
    timeChipsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    timeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 20 },
    timeChipSelected: { backgroundColor: '#F97316' },
    timeChipUnselected: { backgroundColor: '#9CA3AF', opacity: 0.8 },
    timeChipText: { fontSize: 13, fontWeight: '500' },
    timeChipTextSelected: { color: '#FFFFFF' },
    timeChipTextUnselected: { color: '#FFFFFF' },

    reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    reminderText: { fontSize: 14, color: '#374151', marginLeft: 10, fontWeight: '500' },

    modalPrimaryBtn: { backgroundColor: '#F97316', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
    modalPrimaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    modalSecondaryBtn: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    modalSecondaryBtnText: { color: '#374151', fontSize: 15, fontWeight: '600' },

    // Hobbies Modal Styles
    hobbiesModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    hobbiesModalContent: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 24, maxHeight: '80%' },
    hobbiesModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    hobbiesSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
    hobbiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
    hobbyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
    hobbyItemSelected: { backgroundColor: '#FFF5ED', borderColor: '#F97316' },
    hobbyItemText: { fontSize: 14, color: '#4B5563', marginRight: 6 },
    hobbyItemTextSelected: { color: '#F97316', fontWeight: '600' },

    modalInputWithIcon: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        borderWidth: 1, 
        borderColor: '#F3F4F6', 
        borderRadius: 10, 
        paddingRight: 10, 
        marginBottom: 20,
        backgroundColor: '#FFFFFF'
    },
    modalFlexInput: { 
        flex: 1, 
        paddingVertical: 14, 
        paddingHorizontal: 14,
        fontSize: 15, 
        color: '#111827' 
    },
});
