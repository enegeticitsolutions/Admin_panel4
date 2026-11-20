import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

const BLOOD_GROUPS_ENUM_MAP: Record<string, string> = {
    'A+': 'A_positive', 'A-': 'A_negative',
    'B+': 'B_positive', 'B-': 'B_negative',
    'O+': 'O_positive', 'O-': 'O_negative',
    'AB+': 'AB_positive', 'AB-': 'AB_negative',
    'unknown': 'unknown'
};

const ENUM_BLOOD_GROUPS_MAP: Record<string, string> = {
    'A_positive': 'A+', 'A_negative': 'A-',
    'B_positive': 'B+', 'B_negative': 'B-',
    'O_positive': 'O+', 'O_negative': 'O-',
    'AB_positive': 'AB+', 'AB_negative': 'AB-',
    'unknown': 'unknown'
};

export default function HealthInformationScreen() {
    const { width } = useWindowDimensions();
    const MAX_CONTENT_WIDTH = 440;
    const BASE_HORIZONTAL_PADDING = 16;
    const contentWidth = Math.min(Math.max(width - BASE_HORIZONTAL_PADDING * 2, 0), MAX_CONTENT_WIDTH);
    const responsiveContentStyle = { width: contentWidth, alignSelf: 'center' as const };
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();
    const safeBack = useSafeBack();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form States
    const [selectedBlood, setSelectedBlood] = useState('A+');
    const [allergies, setAllergies] = useState<string[]>(['Penicillin', 'Peanuts']);
    const [conditions, setConditions] = useState<string[]>(['Hypertension', 'Type 2 Diabetes']);

    // Modal Add States
    const [addModalType, setAddModalType] = useState<'allergy' | 'condition' | null>(null);
    const [newItemName, setNewItemName] = useState('');

    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    useEffect(() => {
        fetchHealthInfo();
    }, []);

    const fetchHealthInfo = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('userToken');

            if (!token) {
                setLoading(false);
                return;
            }

            const response = await fetch(`${API_URL}/beneficiary/profile/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const result = await response.json();
            if (result.success && result.data) {
                const b = result.data;
                const localBlood = ENUM_BLOOD_GROUPS_MAP[b.bloodGroup] || 'A+';
                setSelectedBlood(localBlood);
                if (b.allergies) {
                    setAllergies(b.allergies);
                }
                if (b.conditions) {
                    const parsedConditions = b.conditions
                        .filter((c: any) => c.isActive)
                        .map((c: any) => c.condition?.name || '');
                    setConditions(parsedConditions.filter(Boolean));
                }
            }
        } catch (e) {
            console.error('Error fetching health details:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('userToken');

            const backendBloodEnum = BLOOD_GROUPS_ENUM_MAP[selectedBlood] || 'A_positive';

            if (token) {
                const response = await fetch(`${API_URL}/beneficiary/profile/health-info`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        bloodGroup: backendBloodEnum,
                        allergies,
                        conditions
                    })
                });

                const result = await response.json();
                if (result.success) {
                    Alert.alert('Success', 'Health information updated successfully!');
                    safeBack();
                } else {
                    Alert.alert('Error', result.message || 'Failed to update health info');
                }
            } else {
                // Mock Success
                Alert.alert('Success (Offline Demo)', 'Health information updated successfully!');
                safeBack();
            }
        } catch (e) {
            console.error('Error saving health info:', e);
            Alert.alert('Error', 'An unexpected error occurred while saving.');
        } finally {
            setSaving(false);
        }
    };

    const removeAllergy = (index: number) => {
        setAllergies(prev => prev.filter((_, i) => i !== index));
    };

    const removeCondition = (index: number) => {
        setConditions(prev => prev.filter((_, i) => i !== index));
    };

    const handleOpenAddModal = (type: 'allergy' | 'condition') => {
        setNewItemName('');
        setAddModalType(type);
    };

    const handleAddItem = () => {
        const cleaned = newItemName.trim();
        if (!cleaned) return;

        if (addModalType === 'allergy') {
            if (allergies.some(item => item.toLowerCase() === cleaned.toLowerCase())) {
                Alert.alert('Info', 'This allergy is already recorded.');
                return;
            }
            setAllergies(prev => [...prev, cleaned]);
        } else if (addModalType === 'condition') {
            if (conditions.some(item => item.toLowerCase() === cleaned.toLowerCase())) {
                Alert.alert('Info', 'This chronic condition is already recorded.');
                return;
            }
            setConditions(prev => [...prev, cleaned]);
        }

        setAddModalType(null);
    };

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#FF6F00" />
                <Text style={styles.loadingText}>Retrieving health records...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={[styles.header, responsiveContentStyle]}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
                    <Feather name="arrow-left" size={20} color="#000000" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Health Information</Text>

                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                <View style={styles.panel}>
                    <Text style={styles.panelLabel}>Blood Type</Text>

                    <View style={styles.bloodGrid}>
                        {bloodTypes.map((type) => {
                            const isSelected = selectedBlood === type;

                            return (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.bloodBtn, isSelected && styles.bloodBtnSelected]}
                                    onPress={() => setSelectedBlood(type)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.bloodBtnText, isSelected && styles.bloodBtnTextSelected]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.panel}>
                    <View style={styles.panelHeaderRow}>
                        <Text style={styles.panelLabelNoMargin}>Allergies</Text>
                        <TouchableOpacity style={styles.addIconBtn} onPress={() => handleOpenAddModal('allergy')}>
                            <Feather name="plus" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {allergies.length === 0 ? (
                        <Text style={styles.emptyLabel}>No allergies recorded.</Text>
                    ) : (
                        allergies.map((allergy, idx) => (
                            <View key={idx} style={styles.itemRow}>
                                <Text style={styles.itemText}>{allergy}</Text>

                                <TouchableOpacity
                                    style={styles.removeBtn}
                                    onPress={() => removeAllergy(idx)}
                                    activeOpacity={0.6}
                                >
                                    <Feather name="x" size={14} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                <View style={styles.panel}>
                    <View style={styles.panelHeaderRow}>
                        <Text style={styles.panelLabelNoMargin}>Chronic Conditions</Text>
                        <TouchableOpacity style={styles.addIconBtn} onPress={() => handleOpenAddModal('condition')}>
                            <Feather name="plus" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {conditions.length === 0 ? (
                        <Text style={styles.emptyLabel}>No chronic conditions recorded.</Text>
                    ) : (
                        conditions.map((condition, idx) => (
                            <View key={idx} style={styles.conditionRow}>
                                <Text style={styles.conditionText}>{condition}</Text>

                                <TouchableOpacity
                                    style={styles.conditionRemoveBtn}
                                    onPress={() => removeCondition(idx)}
                                    activeOpacity={0.6}
                                >
                                    <Feather name="x" size={14} color="#8B5CF6" />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                <View style={styles.alertCard}>
                    <Ionicons name="information-circle-outline" size={20} color="#B45309" style={styles.alertIcon} />
                    <View style={styles.alertTextWrap}>
                        <Text style={styles.alertTitle}>Important</Text>
                        <Text style={styles.alertDesc}>
                            Keep this information up to date. It's shared with your care team and emergency contacts.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.8 }]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.8}
                >
                    <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.summaryLinkBtn}
                    onPress={() => router.push('/(beneficiary)/health-summary')}
                    activeOpacity={0.8}
                >
                    <Feather name="file-text" size={18} color="#FE6700" style={{ marginRight: 8 }} />
                    <Text style={styles.summaryLinkBtnText}>View & Share Full Health Summary</Text>
                </TouchableOpacity>

                <View style={{ height: Platform.OS === 'ios' ? 112 : 96 }} />
            </ScrollView>

            <Modal visible={addModalType !== null} animationType="fade" transparent={true}>
                <View style={styles.backdrop}>
                    <View style={[styles.modalCard, responsiveContentStyle]}>
                        <Text style={styles.modalTitle}>
                            {addModalType === 'allergy' ? 'Add Allergy' : 'Add Chronic Condition'}
                        </Text>

                        <TextInput
                            style={styles.textInput}
                            placeholder={
                                addModalType === 'allergy'
                                    ? 'e.g., Shellfish, Penicillin'
                                    : 'e.g., Hypertension, Diabetes'
                            }
                            placeholderTextColor="#6B7280"
                            value={newItemName}
                            onChangeText={setNewItemName}
                            autoFocus={true}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleAddItem}>
                                <Text style={styles.confirmText}>
                                    {addModalType === 'allergy' ? 'Add Allergy' : 'Add Condition'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModalType(null)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFF0E6',
    },
    header: {
        height: Platform.OS === 'ios' ? 88 : 70,
        paddingTop: Platform.OS === 'ios' ? 18 : 0,
        paddingHorizontal: 0,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerSpacer: {
        width: 40,
        height: 40,
    },
    headerTitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 16,
        lineHeight: 24,
        color: '#000000',
        textAlign: 'center',
    },
    content: {
        paddingHorizontal: 0,
        paddingTop: 16,
        paddingBottom: 96,
    },
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFF0E6',
    },
    loadingText: {
        marginTop: 12,
        color: '#333333',
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
    },
    panel: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1.5,
        elevation: 2,
    },
    panelHeaderRow: {
        height: 32,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    panelLabel: {
        fontFamily: 'Poppins-Medium',
        fontSize: 18,
        lineHeight: 28,
        color: '#000000',
        marginBottom: 12,
    },
    panelLabelNoMargin: {
        fontFamily: 'Poppins-Medium',
        fontSize: 18,
        lineHeight: 28,
        color: '#000000',
    },
    bloodGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    bloodBtn: {
        width: '22.9%',
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    bloodBtnSelected: {
        borderColor: '#FE6700',
        backgroundColor: '#FFF0E6',
        borderWidth: 1.5,
    },
    bloodBtnText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        lineHeight: 20,
        color: '#333333',
    },
    bloodBtnTextSelected: {
        color: '#FE6700',
    },
    addIconBtn: {
        backgroundColor: '#FE6700',
        width: 32,
        height: 32,
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        lineHeight: 20,
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    itemRow: {
        minHeight: 48,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        borderRadius: 14,
        paddingHorizontal: 14,
        marginBottom: 10,
    },
    itemText: {
        flex: 1,
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        lineHeight: 20,
        color: '#991B1B',
    },
    removeBtn: {
        backgroundColor: '#FEE2E2',
        width: 28,
        height: 28,
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    conditionRow: {
        minHeight: 48,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F5F3FF',
        borderRadius: 14,
        paddingHorizontal: 14,
        marginBottom: 10,
    },
    conditionText: {
        flex: 1,
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        lineHeight: 20,
        color: '#6D28D9',
    },
    conditionRemoveBtn: {
        backgroundColor: '#EDE9FE',
        width: 28,
        height: 28,
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    alertCard: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FCD34D',
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        marginBottom: 16,
    },
    alertIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    alertTextWrap: {
        flex: 1,
    },
    alertTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        lineHeight: 20,
        color: '#92400E',
        marginBottom: 4,
    },
    alertDesc: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        lineHeight: 18,
        color: '#B45309',
    },
    saveBtn: {
        height: 52,
        backgroundColor: '#FE6700',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        lineHeight: 24,
        fontFamily: 'Poppins-Medium',
    },
    summaryLinkBtn: {
        height: 50,
        backgroundColor: '#FFF0E6',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#FE6700',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    summaryLinkBtnText: {
        color: '#FE6700',
        fontSize: 15,
        fontFamily: 'Poppins-Medium',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 440,
    },
    modalTitle: {
        fontFamily: 'Poppins-Medium',
        fontSize: 18,
        lineHeight: 28,
        color: '#000000',
        marginBottom: 16,
    },
    textInput: {
        height: 50,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 16,
        fontSize: 16,
        fontFamily: 'Poppins-Regular',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        marginBottom: 24,
    },
    modalActions: {
        gap: 12,
    },
    confirmBtn: {
        height: 52,
        borderRadius: 14,
        backgroundColor: '#FE6700',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 16,
        lineHeight: 24,
        color: '#FFFFFF',
    },
    cancelBtn: {
        height: 54,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 16,
        lineHeight: 24,
        color: '#333333',
    },
});
