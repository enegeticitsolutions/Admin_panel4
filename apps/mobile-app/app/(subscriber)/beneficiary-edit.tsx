import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import GlobalDrawer from './components/shared/GlobalDrawer';
import { Animated, Dimensions } from 'react-native';
import { AddMedicationModal, MedicationFormPayload } from '@/components/medications/AddMedicationModal';
import { AddressInputField } from '../../components/ui/AddressInputField';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { scale } from '@/utils/responsive';

export default function EditBeneficiaryScreen() {
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();
    const safeBack = useSafeBack();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [canEdit, setCanEdit] = useState(true);
    const [userData, setUserData] = useState<any>(null);

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { width } = Dimensions.get('window');
    const DRAWER_WIDTH = width * 0.75;
    const drawerAnim = React.useRef(new Animated.Value(DRAWER_WIDTH)).current;

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    };
    const closeDrawer = () => {
        Animated.timing(drawerAnim, { toValue: DRAWER_WIDTH, duration: 240, useNativeDriver: true }).start(() => setDrawerOpen(false));
    };

    // Form States
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [relationship, setRelationship] = useState('');
    const [address, setAddress] = useState('');
    const [flatPlot, setFlatPlot] = useState('');
    const [streetArea, setStreetArea] = useState('');
    const [landmark, setLandmark] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [pincode, setPincode] = useState('');
    const [latitude, setLatitude] = useState(0);
    const [longitude, setLongitude] = useState(0);
    const [conditions, setConditions] = useState<string[]>([]);
    const [medications, setMedications] = useState<MedicationFormPayload[]>([]);
    const [physicianName, setPhysicianName] = useState('');
    const [physicianPhone, setPhysicianPhone] = useState('');
    const [physicianSpec, setPhysicianSpec] = useState('');
    const [gender, setGender] = useState('');
    const [hobbiesText, setHobbiesText] = useState('');
    const [vitals, setVitals] = useState<Record<string, boolean>>({});

    // UI States
    const [showConditionModal, setShowConditionModal] = useState(false);
    const [newCondition, setNewCondition] = useState('');
    const [showMedicineModal, setShowMedicineModal] = useState(false);
    const [showHobbiesModal, setShowHobbiesModal] = useState(false);
    const [showRelationshipModal, setShowRelationshipModal] = useState(false);
    const relationships = ['Self', 'Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Sibling', 'Guardian', 'Friend', 'Other'];
    const availableHobbies = [
        'Reading', 'Gardening', 'Traveling', 'Music', 'Cooking',
        'Photography', 'Yoga/Exercise', 'Painting/Sketching',
        'Socializing', 'Movies/TV', 'Playing Cards/Board Games', 'Other'
    ];

    const [vitalsConfig, setVitalsConfig] = useState<any[]>([]);

    // Custom Alert State to ensure it looks like an App on both Web and Mobile
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });

    const showAlert = (title: string, message: string) => {
        setAlertConfig({ visible: true, title, message });
    };

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            try {
                const token = await AsyncStorage.getItem('userToken');
                const userStr = await AsyncStorage.getItem('userData');
                if (userStr && isMounted) setUserData(JSON.parse(userStr));

                // Fetch vitals config and beneficiary profile concurrently
                const [vRes, bRes] = await Promise.all([
                    fetch(`${API_URL}/public/vitals?activeOnly=true`),
                    fetch(`${API_URL}/subscriber/beneficiaries/${id}/profile`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                const [vData, bData] = await Promise.all([
                    vRes.json(),
                    bRes.json()
                ]);

                if (!isMounted) return;

                if (vData.success) setVitalsConfig(vData.data || []);

                if (bData.success) {
                    const beneficiary = bData.data;
                    if (beneficiary.canEditDetails === false) setCanEdit(false);
                    setName(beneficiary.name || '');
                    setAge(String(beneficiary.age || ''));
                    setGender(beneficiary.gender || 'male');
                    setRelationship(beneficiary.relationship || '');
                    setAddress(beneficiary.address || '');
                    setConditions(beneficiary.conditions?.map((c: any) => c.condition?.name) || []);
                    setMedications(beneficiary.medicationList?.map((m: any) => ({
                        id: m.id,
                        name: m.name,
                        dosage: m.dosage,
                        route: m.route || 'oral',
                        cadence: m.cadence || 'daily',
                        frequency: m.frequency || 'once_daily',
                        timeSlots: m.timeSlots || [],
                        instructions: m.instructions || '',
                        startDate: m.startDate || '',
                        endDate: m.endDate || '',
                        setReminders: !!m.setReminders
                    })) || []);
                    setPhysicianName(beneficiary.primaryPhysicianName || '');
                    setPhysicianPhone(beneficiary.primaryPhysicianPhone || '');
                    setPhysicianSpec(beneficiary.primaryPhysicianSpec || '');
                    setHobbiesText(beneficiary.hobbiesInterests?.join(', ') || '');

                    // Set detailed address fields
                    setFlatPlot(beneficiary.flatPlot || '');
                    setStreetArea(beneficiary.streetArea || '');
                    setLandmark(beneficiary.landmark || '');
                    setCity(beneficiary.city || '');
                    setState(beneficiary.state || '');
                    setPincode(beneficiary.pincode || '');
                    setLatitude(beneficiary.latitude || 0);
                    setLongitude(beneficiary.longitude || 0);

                    const vFlags: Record<string, boolean> = {};
                    if (beneficiary.vitalConfigs) {
                        beneficiary.vitalConfigs.forEach((config: any) => {
                            vFlags[config.vitalDefinitionId] = !!config.isActive;
                        });
                    }
                    setVitals(vFlags);
                }
            } catch (e) {
                console.error('Init error:', e);
                showAlert('Error', 'Failed to load beneficiary data');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        if (id) init();
        return () => { isMounted = false; };
    }, [id]);

    const handleSave = async () => {
        const missingFields: string[] = [];
        if (!name?.trim()) missingFields.push('Full Name');
        if (!age || isNaN(parseInt(age))) missingFields.push('Age');
        if (!streetArea?.trim()) missingFields.push('Street / Area');
        if (!city?.trim()) missingFields.push('City');
        if (!state?.trim()) missingFields.push('State');
        if (!pincode?.trim()) missingFields.push('Pincode');

        if (missingFields.length > 0) {
            showAlert('Missing Details', `Please fill in the following required fields:\n- ${missingFields.join('\n- ')}`);
            return;
        }

        if (!canEdit) {
            showAlert('Read-Only Access', 'You have View-Only access to this profile. Only primary caregivers and authorized editors can save modifications.');
            return;
        }

        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const cleanAge = parseInt(age);
            const payload = {
                name,
                age: isNaN(cleanAge) ? null : cleanAge,
                gender,
                relationship,
                address,
                flatPlot,
                streetArea,
                landmark,
                city,
                state,
                pincode,
                latitude,
                longitude,
                medicalConditions: conditions,
                medications,
                primaryPhysicianName: physicianName,
                primaryPhysicianPhone: physicianPhone,
                primaryPhysicianSpec: physicianSpec,
                hobbiesInterests: hobbiesText.split(', ').filter(Boolean),
                vitalsData: vitals // Send as a separate object for relational update
            };

            const res = await fetch(`${API_URL}/subscriber/beneficiaries/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.success) {
                showAlert('Success', 'Profile updated successfully!');
                safeBack();
            } else if (result.errors) {
                // Specific validation errors from Joi
                showAlert('Validation Error', result.errors.join('\n'));
            } else {
                showAlert('Error', result.message || 'Failed to update details');
            }
        } catch (e) {
            showAlert('Error', 'Connection error');
        } finally {
            setSaving(false);
        }
    };

    const toggleHobby = (hobby: string) => {
        const currentHobbies = hobbiesText ? hobbiesText.split(', ').filter(Boolean) : [];
        let updatedHobbies;
        if (currentHobbies.includes(hobby)) {
            updatedHobbies = currentHobbies.filter(h => h !== hobby);
        } else {
            updatedHobbies = [...currentHobbies, hobby];
        }
        setHobbiesText(updatedHobbies.join(', '));
    };

    if (loading) return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.inlineHeader}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={scale(24)} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={styles.iconBtn} />
            </View>
            <View style={[styles.center, { flex: 1, backgroundColor: '#FAF5F0' }]}>
                <ActivityIndicator size="large" color="#F97316" />
                <Text style={{ marginTop: scale(12), fontSize: scale(14), color: '#6B7280', fontWeight: '500' }}>
                    Loading profile details...
                </Text>
            </View>
        </SafeAreaView>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Simple inline header */}
            <View style={styles.inlineHeader}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={scale(24)} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={openDrawer} style={styles.iconBtn}>
                    <Ionicons name="menu-outline" size={scale(28)} color="#111827" />
                </TouchableOpacity>
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {!canEdit && (
                        <View style={styles.viewOnlyBanner}>
                            <Ionicons name="eye-outline" size={scale(20)} color="#4B5563" style={{ marginRight: scale(10) }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.viewOnlyBannerTitle}>View-Only Access</Text>
                                <Text style={styles.viewOnlyBannerDesc}>
                                    You have View-Only access to this profile. Modifications cannot be saved.
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Basic Info */}
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Basic Information</Text>
                        <Text style={styles.inputLabel}>Full Name</Text>
                        <TextInput style={styles.input} value={name} onChangeText={setName} />

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: scale(10) }}>
                                <Text style={styles.inputLabel}>Age</Text>
                                <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Relationship</Text>
                                <TouchableOpacity
                                    style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: scale(14) }]}
                                    onPress={() => setShowRelationshipModal(true)}
                                >
                                    <Text style={{ flex: 1, color: relationship ? '#111827' : '#9CA3AF' }}>
                                        {relationship || 'Select'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={scale(18)} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Custom Relationship Input for 'Other' */}
                        {(relationship === 'Other' || (!relationships.includes(relationship) && relationship !== '')) && (
                            <View style={{ marginTop: scale(8) }}>
                                <Text style={styles.inputLabel}>Please Specify Relationship</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Grandfather, Aunt, etc."
                                    placeholderTextColor="#9CA3AF"
                                    value={relationship === 'Other' ? '' : relationship}
                                    onChangeText={setRelationship}
                                />
                            </View>
                        )}

                        <Text style={styles.inputLabel}>Gender</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), marginBottom: scale(8) }}>
                            {['male', 'female', 'other', 'prefer_not_to_say'].map((g) => (
                                <TouchableOpacity
                                    key={g}
                                    onPress={() => setGender(g)}
                                    style={{
                                        paddingHorizontal: scale(12), paddingVertical: scale(8), borderRadius: scale(20),
                                        backgroundColor: gender === g ? '#F97316' : '#F3F4F6',
                                        borderWidth: 1, borderColor: gender === g ? '#F97316' : '#E5E7EB'
                                    }}
                                >
                                    <Text style={{ fontSize: scale(12), color: gender === g ? '#FFF' : '#374151', textTransform: 'capitalize', fontWeight: gender === g ? '700' : '500' }}>
                                        {g === 'prefer_not_to_say' ? 'Private' : g}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.inputLabel}>Address</Text>
                        <AddressInputField
                            label=""
                            value={address}
                            onChangeText={setAddress}
                            onLocationFetched={(details) => {
                                if (details.address) setAddress(details.address);
                                if (details.city) setCity(details.city);
                                if (details.state) setState(details.state);
                                if (details.pincode) setPincode(details.pincode);
                                if (details.latitude) setLatitude(details.latitude);
                                if (details.longitude) setLongitude(details.longitude);
                                // Set streetArea as the first part of the address
                                if (details.address) setStreetArea(details.address.split(',')[0]);
                            }}
                        />

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: scale(10) }}>
                                <Text style={styles.inputLabel}>Flat / Plot / Building</Text>
                                <TextInput style={styles.input} value={flatPlot} onChangeText={setFlatPlot} placeholder="e.g. 402, Sunshine" />
                            </View>
                            <View style={{ flex: 1.5 }}>
                                <Text style={styles.inputLabel}>Street / Area *</Text>
                                <TextInput style={styles.input} value={streetArea} onChangeText={setStreetArea} placeholder="e.g. Sector 15" />
                            </View>
                        </View>

                        <Text style={styles.inputLabel}>Landmark (Optional)</Text>
                        <TextInput style={styles.input} value={landmark} onChangeText={setLandmark} placeholder="e.g. Near HDFC Bank" />

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: scale(10) }}>
                                <Text style={styles.inputLabel}>City *</Text>
                                <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Pincode *</Text>
                                <TextInput style={styles.input} value={pincode} onChangeText={setPincode} keyboardType="numeric" placeholder="Pincode" />
                            </View>
                        </View>

                        <Text style={styles.inputLabel}>State *</Text>
                        <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="State" />

                        {latitude !== 0 && (
                            <View style={styles.coordsBadge}>
                                <Ionicons name="location" size={scale(12)} color="#10B981" />
                                <Text style={styles.coordsText}>GPS coordinates saved</Text>
                            </View>
                        )}
                    </View>

                    {/* Medical Conditions */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.sectionTitle}>Medical Conditions</Text>
                            <TouchableOpacity onPress={() => setShowConditionModal(true)} style={styles.addBtn}>
                                <Ionicons name="add" size={scale(20)} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.tagsContainer}>
                            {conditions.map((c, i) => (
                                <View key={i} style={styles.tag}>
                                    <Text style={styles.tagText}>{c}</Text>
                                    <TouchableOpacity onPress={() => setConditions(conditions.filter((_, idx) => idx !== i))}>
                                        <Ionicons name="close-circle" size={scale(18)} color="#F97316" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {conditions.length === 0 && <Text style={styles.emptyText}>No conditions added</Text>}
                        </View>
                    </View>

                    {/* Medications */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.sectionTitle}>Current Medications</Text>
                            <TouchableOpacity onPress={() => setShowMedicineModal(true)} style={styles.addBtn}>
                                <Ionicons name="add" size={scale(20)} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        {medications.map((m, i) => (
                            <View key={i} style={styles.medItem}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.medName}>{m.name}</Text>
                                    <Text style={styles.medSub}>{m.dosage} • {m.frequency}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setMedications(medications.filter((_, idx) => idx !== i))}>
                                    <Ionicons name="trash-outline" size={scale(20)} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {medications.length === 0 && <Text style={styles.emptyText}>No medications added</Text>}
                    </View>

                    {/* Vitals Tracking */}
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Vitals Tracking Preferences</Text>
                        {vitalsConfig.map((v) => (
                            <View key={v.id} style={styles.switchRow}>
                                <Text style={styles.switchLabel}>{v.name} {v.unit ? `(${v.unit})` : ''}</Text>
                                <Switch
                                    value={!!vitals[v.id]}
                                    onValueChange={(val) => setVitals({ ...vitals, [v.id]: val })}
                                    trackColor={{ false: "#D1D5DB", true: "#FDBA74" }}
                                    thumbColor={vitals[v.id] ? "#F97316" : "#f4f3f4"}
                                />
                            </View>
                        ))}
                        {vitalsConfig.length === 0 && <Text style={styles.emptyText}>No vitals defined</Text>}
                    </View>

                    {/* Physician Info */}
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Primary Physician</Text>
                        <Text style={styles.inputLabel}>Doctor Name</Text>
                        <TextInput style={styles.input} value={physicianName} onChangeText={setPhysicianName} />
                        <Text style={styles.inputLabel}>Contact Number</Text>
                        <TextInput style={styles.input} value={physicianPhone} onChangeText={setPhysicianPhone} keyboardType="numeric" />
                        <Text style={styles.inputLabel}>Specialization</Text>
                        <TextInput style={styles.input} value={physicianSpec} onChangeText={setPhysicianSpec} />
                    </View>

                    {/* Hobbies */}
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Hobbies & Interests</Text>
                        <TouchableOpacity style={styles.input} onPress={() => setShowHobbiesModal(true)}>
                            <Text style={{ color: hobbiesText ? '#111827' : '#9CA3AF' }}>
                                {hobbiesText || "Select interests"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={[styles.saveBtn, (!canEdit || saving) && { opacity: 0.6, backgroundColor: !canEdit ? '#9CA3AF' : '#F97316' }]} 
                        onPress={handleSave} 
                        disabled={!canEdit || saving}
                    >
                        {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{canEdit ? 'Save Changes' : 'View Only (Read Only)'}</Text>}
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>

            {/* Modals */}
            <Modal visible={showConditionModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Condition</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Diabetes"
                            value={newCondition}
                            onChangeText={setNewCondition}
                            autoFocus
                        />
                        <TouchableOpacity style={styles.modalBtn} onPress={() => {
                            if (newCondition) setConditions([...conditions, newCondition]);
                            setNewCondition(''); setShowConditionModal(false);
                        }}>
                            <Text style={styles.modalBtnText}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowConditionModal(false)} style={{ marginTop: scale(15), alignItems: 'center' }}>
                            <Text style={{ color: '#6B7280' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <AddMedicationModal
                visible={showMedicineModal}
                onClose={() => setShowMedicineModal(false)}
                onSave={async (med) => {
                    setMedications(prev => [...prev, {
                        ...med,
                    }]);
                    setShowMedicineModal(false);
                }}
            />

            {/* Relationship Selection Modal */}
            <Modal visible={showRelationshipModal} transparent animationType="slide">
                <Pressable style={styles.modalOverlay} onPress={() => setShowRelationshipModal(false)}>
                    <View style={styles.hobbiesContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Relationship</Text>
                            <TouchableOpacity onPress={() => setShowRelationshipModal(false)}>
                                <Ionicons name="close" size={scale(24)} color="#111827" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {relationships.map((rel) => (
                                <TouchableOpacity
                                    key={rel}
                                    style={[
                                        styles.optionBtn,
                                        relationship === rel && styles.optionBtnActive
                                    ]}
                                    onPress={() => {
                                        setRelationship(rel);
                                        setShowRelationshipModal(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        relationship === rel && styles.optionTextActive
                                    ]}>{rel}</Text>
                                    {relationship === rel && (
                                        <Ionicons name="checkmark-circle" size={scale(20)} color="#F97316" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* Hobbies Modal */}
            <Modal visible={showHobbiesModal} transparent animationType="slide">
                <View style={styles.hobbiesOverlay}>
                    <View style={styles.hobbiesContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Interests & Hobbies</Text>
                            <TouchableOpacity onPress={() => setShowHobbiesModal(false)}><Ionicons name="close" size={scale(24)} /></TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.hobbiesGrid}>
                            {availableHobbies.map((h) => {
                                const active = hobbiesText.split(', ').includes(h);
                                return (
                                    <TouchableOpacity key={h} style={[styles.hobbyItem, active && styles.hobbyActive]} onPress={() => toggleHobby(h)}>
                                        <Text style={{ color: active ? '#F97316' : '#4B5563' }}>{h}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <TouchableOpacity style={styles.modalBtn} onPress={() => setShowHobbiesModal(false)}>
                            <Text style={styles.modalBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Custom UI Alert Modal */}
            <Modal visible={alertConfig.visible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{alertConfig.title}</Text>
                        <Text style={{ fontSize: scale(15), color: '#4B5563', marginBottom: scale(24), lineHeight: scale(22) }}>
                            {alertConfig.message}
                        </Text>
                        <TouchableOpacity 
                            style={styles.modalBtn} 
                            onPress={() => setAlertConfig({ visible: false, title: '', message: '' })}
                        >
                            <Text style={styles.modalBtnText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <GlobalDrawer
                isOpen={drawerOpen}
                onClose={closeDrawer}
                drawerAnim={drawerAnim}
                userData={userData}
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FAF5F0' },
    inlineHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: scale(12), paddingVertical: scale(10), backgroundColor: '#FAF5F0',
    },
    headerTitle: { flex: 1, fontSize: scale(17), fontWeight: '600', color: '#111827', marginLeft: scale(6) },
    iconBtn: { width: scale(36), height: scale(36), justifyContent: 'center', alignItems: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: scale(20) },
    card: { backgroundColor: '#FFF', borderRadius: scale(16), padding: scale(20), marginBottom: scale(16), elevation: 2 },
    sectionTitle: { fontSize: scale(16), fontWeight: '700', color: '#111827', marginBottom: scale(16) },
    inputLabel: { fontSize: scale(13), fontWeight: '600', color: '#6B7280', marginBottom: scale(8), marginTop: scale(8) },
    input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: scale(10), padding: scale(12), fontSize: scale(15), color: '#111827' },
    row: { flexDirection: 'row', marginTop: scale(8) },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(12) },
    addBtn: { width: scale(30), height: scale(30), borderRadius: scale(15), backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center' },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
    tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5ED', paddingHorizontal: scale(12), paddingVertical: scale(6), borderRadius: scale(20) },
    tagText: { fontSize: scale(14), color: '#F97316', marginRight: scale(4) },
    emptyText: { color: '#9CA3AF', fontStyle: 'italic', fontSize: scale(13) },
    medItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: scale(12), borderRadius: scale(10), marginBottom: scale(8) },
    medName: { fontWeight: '600', color: '#111827' },
    medSub: { fontSize: scale(12), color: '#6B7280' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: scale(10), borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    switchLabel: { fontSize: scale(14), color: '#374151' },
    saveBtn: { backgroundColor: '#F97316', paddingVertical: scale(16), borderRadius: scale(12), alignItems: 'center', marginTop: scale(10) },
    saveBtnText: { color: '#FFF', fontSize: scale(16), fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: scale(20) },
    modalContent: { backgroundColor: '#FFF', borderRadius: scale(20), padding: scale(24) },
    modalTitle: { fontSize: scale(18), fontWeight: '700', marginBottom: scale(20) },
    modalInput: { backgroundColor: '#F9FAFB', borderRadius: scale(10), padding: scale(14), marginBottom: scale(16) },
    modalBtn: { backgroundColor: '#F97316', padding: scale(14), borderRadius: scale(10), alignItems: 'center' },
    modalBtnText: { color: '#FFF', fontWeight: '700' },
    hobbiesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    hobbiesContent: { backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: scale(24), maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(20) },
    hobbiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10), paddingBottom: scale(20) },
    hobbyItem: { backgroundColor: '#F3F4F6', paddingHorizontal: scale(16), paddingVertical: scale(8), borderRadius: scale(20), borderWidth: 1, borderColor: '#E5E7EB' },
    hobbyActive: { backgroundColor: '#FFF5ED', borderColor: '#F97316' },
    optionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: scale(15), paddingHorizontal: scale(10), borderRadius: scale(10), marginBottom: scale(5) },
    optionBtnActive: { backgroundColor: '#FFF5ED' },
    optionText: { fontSize: scale(16), color: '#4B5563' },
    optionTextActive: { color: '#F97316', fontWeight: '600' },
    coordsBadge: { flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: scale(10), backgroundColor: '#ECFDF5', paddingHorizontal: scale(10), paddingVertical: scale(6), borderRadius: scale(8), alignSelf: 'flex-start' },
    coordsText: { fontSize: scale(12), color: '#10B981', fontWeight: '600' },
    viewOnlyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: scale(12),
        padding: scale(14),
        marginBottom: scale(16),
    },
    viewOnlyBannerTitle: {
        fontSize: scale(14),
        fontWeight: '700',
        color: '#374151',
    },
    viewOnlyBannerDesc: {
        fontSize: scale(12),
        color: '#6B7280',
        marginTop: scale(2),
        lineHeight: scale(16),
    },
});
