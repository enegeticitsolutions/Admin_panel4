import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Modal,
    Alert,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

interface EmergencyContact {
    name: string;
    phone: string;
    email?: string;
    relationship: string;
    isPrimary: boolean;
}

export default function EmergencyContactsScreen() {
    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    useAndroidBackHandler();
    const safeBack = useSafeBack();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [contacts, setContacts] = useState<EmergencyContact[]>([]);

    // Edit/Add Modal States
    const [modalVisible, setModalVisible] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactRelation, setContactRelation] = useState('');
    const [isPrimaryContact, setIsPrimaryContact] = useState(false);

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('userToken');

            if (!token) {
                useFallbackContacts();
                return;
            }

            const response = await fetch(`${API_URL}/beneficiary/profile/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const result = await response.json();
            if (result.success && result.data && result.data.emergencyContacts) {
                const ec = result.data.emergencyContacts;
                if (ec.length > 0) {
                    setContacts(
                        ec.map((c: any) => ({
                            name: c.name,
                            phone: c.phone,
                            email: c.email || '',
                            relationship: c.relationship,
                            isPrimary: !!c.isPrimary,
                        }))
                    );
                } else {
                    useFallbackContacts();
                }
            } else {
                useFallbackContacts();
            }
        } catch (e) {
            console.error('Error fetching emergency contacts:', e);
            useFallbackContacts();
        } finally {
            setLoading(false);
        }
    };

    const useFallbackContacts = () => {
        setContacts([
            {
                name: 'Mayur Jain',
                phone: '+1 (555) 123-4567',
                email: 'robert.williams@email.com',
                relationship: 'Son',
                isPrimary: true,
            },
            {
                name: 'Sonali Jain',
                phone: '+1 (555) 234-5678',
                email: 'jennifer.davis@email.com',
                relationship: 'Daughter',
                isPrimary: false,
            },
        ]);
    };

    const handleSaveContacts = async (updatedContacts: EmergencyContact[]) => {
        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('userToken');

            if (token) {
                const response = await fetch(`${API_URL}/beneficiary/profile/emergency-contacts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ contacts: updatedContacts }),
                });

                const result = await response.json();
                if (result.success) {
                    setContacts(updatedContacts);
                } else {
                    Alert.alert('Error', result.message || 'Failed to save emergency contacts');
                }
            } else {
                setContacts(updatedContacts);
            }
        } catch (e) {
            console.error('Save Contacts Error:', e);
            Alert.alert('Error', 'An error occurred while saving.');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenEdit = (index: number) => {
        const c = contacts[index];
        setEditIndex(index);
        setContactName(c.name);
        setContactPhone(c.phone);
        setContactEmail(c.email || '');
        setContactRelation(c.relationship);
        setIsPrimaryContact(c.isPrimary);
        setModalVisible(true);
    };

    const handleOpenAdd = () => {
        setEditIndex(null);
        setContactName('');
        setContactPhone('');
        setContactEmail('');
        setContactRelation('');
        // If there are no contacts, make this one primary by default
        setIsPrimaryContact(contacts.length === 0);
        setModalVisible(true);
    };

    const handleSetPrimary = (index: number) => {
        const updated = contacts.map((c, i) => ({
            ...c,
            isPrimary: i === index,
        }));
        handleSaveContacts(updated);
    };

    const handleConfirmSave = () => {
        const nameClean = contactName.trim();
        const phoneClean = contactPhone.trim();
        const emailClean = contactEmail.trim();
        const relationClean = contactRelation.trim();

        if (!nameClean || !phoneClean || !relationClean) {
            Alert.alert('Error', 'Please fill in Name, Phone, and Relationship.');
            return;
        }

        let updated = [...contacts];

        // If setting this one as primary, ensure all others are marked false
        if (isPrimaryContact) {
            updated = updated.map((c) => ({ ...c, isPrimary: false }));
        }

        const newContact: EmergencyContact = {
            name: nameClean,
            phone: phoneClean,
            email: emailClean || undefined,
            relationship: relationClean,
            isPrimary: isPrimaryContact || contacts.length === 0, // force true if first contact
        };

        if (editIndex !== null) {
            updated[editIndex] = newContact;
        } else {
            updated.push(newContact);
        }

        setModalVisible(false);
        handleSaveContacts(updated);
    };

    const handleDeleteContact = (index: number) => {
        const contactName = contacts[index]?.name || 'this contact';

        if (Platform.OS === 'web') {
            const confirmed = window.confirm(`Are you sure you want to delete ${contactName}?`);
            if (confirmed) {
                let updated = contacts.filter((_, i) => i !== index);
                if (contacts[index].isPrimary && updated.length > 0) {
                    updated[0].isPrimary = true;
                }
                handleSaveContacts(updated);
            }
            return;
        }

        Alert.alert(
            'Delete Contact',
            `Are you sure you want to delete ${contactName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        let updated = contacts.filter((_, i) => i !== index);
                        // If we deleted the primary contact, and there are others left, make the first one primary
                        if (contacts[index].isPrimary && updated.length > 0) {
                            updated[0].isPrimary = true;
                        }
                        handleSaveContacts(updated);
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#FF6F00" />
                <Text style={styles.loadingText}>Loading emergency contacts...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Top Navigation Bar / Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Feather name="arrow-left" size={22} color="#000000" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Emergency Contacts</Text>

                <TouchableOpacity onPress={handleOpenAdd} style={styles.addCircleHeaderBtn} activeOpacity={0.8}>
                    <Feather name="plus" size={22} color="#FFFFFF" />
                </TouchableOpacity>
            </View>

            {/* Page Content Body */}
            <View style={styles.bodyWrapper}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {contacts.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <MaterialCommunityIcons name="phone-off" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>No emergency contacts found. Tap + to add one.</Text>
                        </View>
                    ) : (
                        contacts.map((c, idx) => (
                            <View key={idx} style={styles.contactCard}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.leftLabelCol}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.contactName}>{c.name}</Text>
                                            {c.isPrimary && (
                                                <FontAwesome
                                                    name="star"
                                                    size={16}
                                                    color="#FFB800"
                                                    style={styles.primaryStarIcon}
                                                />
                                            )}
                                        </View>
                                        <Text style={styles.relationshipText}>{c.relationship}</Text>
                                    </View>

                                    <View style={styles.cardHeaderRight}>
                                        <TouchableOpacity
                                            onPress={() => handleDeleteContact(idx)}
                                            style={styles.trashBtn}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            activeOpacity={0.7}
                                        >
                                            <Feather name="trash-2" size={20} color="#DC2626" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => handleOpenEdit(idx)}
                                    style={styles.cardBody}
                                >
                                    <View style={styles.infoLine}>
                                        <Feather name="phone" size={16} color="#374151" style={styles.infoIcon} />
                                        <Text style={styles.orangeLinkText}>{c.phone}</Text>
                                    </View>

                                    {c.email ? (
                                        <View style={styles.infoLine}>
                                            <Feather name="mail" size={16} color="#374151" style={styles.infoIcon} />
                                            <Text style={styles.orangeLinkText}>{c.email}</Text>
                                        </View>
                                    ) : null}
                                </TouchableOpacity>

                                {!c.isPrimary && (
                                    <TouchableOpacity
                                        style={styles.setPrimaryBtn}
                                        onPress={() => handleSetPrimary(idx)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.setPrimaryBtnText}>Set as Primary</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))
                    )}

                    <View style={styles.infoNoteCard}>
                        <Text style={styles.infoNoteTitle}>Emergency Contact Info</Text>
                        <Text style={styles.infoNoteDesc}>
                            These contacts will be notified in case of emergency. The primary contact will be called first.
                        </Text>
                    </View>

                    <View style={{ height: Platform.OS === 'ios' ? 112 : 96 }} />
                </ScrollView>
            </View>

            {/* Add / Edit Contact Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.backdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editIndex !== null ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeModalBtn}>
                                <Feather name="x" size={20} color="#4B5563" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. Mayur Jain"
                                placeholderTextColor="#6B7280"
                                value={contactName}
                                onChangeText={setContactName}
                            />

                            <Text style={styles.label}>Relationship</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. Son, Daughter, Doctor"
                                placeholderTextColor="#6B7280"
                                value={contactRelation}
                                onChangeText={setContactRelation}
                            />

                            <Text style={styles.label}>Phone Number</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. +1 (555) 123-4567"
                                placeholderTextColor="#6B7280"
                                value={contactPhone}
                                onChangeText={setContactPhone}
                                keyboardType="phone-pad"
                            />

                            <Text style={styles.label}>Email Address (Optional)</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. robert.williams@email.com"
                                placeholderTextColor="#6B7280"
                                value={contactEmail}
                                onChangeText={setContactEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setIsPrimaryContact((prev) => !prev)}
                                activeOpacity={0.8}
                                disabled={editIndex !== null && contacts[editIndex].isPrimary}
                            >
                                <View
                                    style={[
                                        styles.checkbox,
                                        (isPrimaryContact || (editIndex !== null && contacts[editIndex].isPrimary)) &&
                                            styles.checkboxActive,
                                    ]}
                                >
                                    {(isPrimaryContact || (editIndex !== null && contacts[editIndex].isPrimary)) && (
                                        <Feather name="check" size={13} color="#FFFFFF" />
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>Set as Primary Contact</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.saveBtn, saving && { opacity: 0.8 }]}
                                onPress={handleConfirmSave}
                                activeOpacity={0.8}
                                disabled={saving}
                            >
                                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Contact'}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        height: 56,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        fontSize: 17,
        lineHeight: 24,
        color: '#000000',
    },
    addCircleHeaderBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#FE6700',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bodyWrapper: {
        flex: 1,
        backgroundColor: '#FEF3EC',
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 110,
    },
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FEF3EC',
    },
    loadingText: {
        marginTop: 12,
        color: '#333333',
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
    },
    emptyBox: {
        alignItems: 'center',
        paddingVertical: 60,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
    },
    emptyText: {
        marginTop: 12,
        color: '#9CA3AF',
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 20,
    },
    contactCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    leftLabelCol: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    contactName: {
        fontSize: 18,
        lineHeight: 26,
        color: '#000000',
        fontFamily: 'Poppins-Medium',
        fontWeight: '600',
    },
    primaryStarIcon: {
        marginLeft: 8,
    },
    relationshipText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#4B5563',
        fontFamily: 'Poppins-Regular',
        marginTop: 2,
    },
    cardHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    trashBtn: {
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardBody: {
        gap: 8,
        marginVertical: 4,
    },
    infoLine: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoIcon: {
        width: 20,
        marginRight: 8,
    },
    orangeLinkText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        color: '#FE6700',
        fontFamily: 'Poppins-Regular',
    },
    setPrimaryBtn: {
        height: 44,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        marginTop: 12,
    },
    setPrimaryBtnText: {
        color: '#000000',
        fontSize: 15,
        lineHeight: 22,
        fontFamily: 'Poppins-Medium',
        fontWeight: '600',
    },
    infoNoteCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#9CA3AF',
    },
    infoNoteTitle: {
        fontSize: 15,
        lineHeight: 22,
        color: '#000000',
        fontFamily: 'Poppins-Medium',
        fontWeight: '600',
        marginBottom: 6,
    },
    infoNoteDesc: {
        fontSize: 14,
        lineHeight: 20,
        color: '#374151',
        fontFamily: 'Poppins-Regular',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 18,
        lineHeight: 28,
        color: '#000000',
        fontFamily: 'Poppins-Medium',
    },
    closeModalBtn: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label: {
        fontSize: 14,
        lineHeight: 20,
        color: '#333333',
        fontFamily: 'Poppins-Medium',
        marginBottom: 6,
        marginTop: 14,
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
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        backgroundColor: '#FFFFFF',
    },
    checkboxActive: {
        backgroundColor: '#FE6700',
        borderColor: '#FE6700',
    },
    checkboxLabel: {
        fontSize: 14,
        lineHeight: 20,
        color: '#333333',
        fontFamily: 'Poppins-Regular',
    },
    saveBtn: {
        height: 52,
        backgroundColor: '#FE6700',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        marginBottom: 12,
    },
    saveBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        lineHeight: 24,
        fontFamily: 'Poppins-Medium',
    },
});
