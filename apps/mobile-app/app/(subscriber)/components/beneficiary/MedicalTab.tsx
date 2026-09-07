import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions, Alert, Modal, TextInput, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { AddMedicineModal, MedicationFormData } from '@/components/ui/AddMedicineModal';
import { scale } from '@/utils/responsive';

const { width } = Dimensions.get('window');

const VITAL_COLORS = [
    '#FCE7EC', // soft pink - blood pressure
    '#FCE4F0', // soft rose - heart rate
    '#FFF0E5', // soft orange - blood sugar
    '#E3F2FD', // soft blue - temperature
    '#E8F5E9', // soft green - oxygen
    '#FFF9C4', // soft yellow - mood
    '#F3E5F5', // soft purple - other
    '#E0F7FA', // soft teal - other
];

const getVitalColor = (label: string, index: number) => {
    const map: Record<string, string> = {
        'blood pressure': '#FCE7EC',
        'heart rate': '#FCE4F0',
        'blood sugar': '#FFF0E5',
        'temperature': '#E3F2FD',
        'body temperature': '#E3F2FD',
        'blood oxygen saturation': '#E8F5E9',
        'oxygen': '#E8F5E9',
        'mood': '#FFF9C4',
    };
    return map[label.toLowerCase()] || VITAL_COLORS[index % VITAL_COLORS.length];
};

const MedicalRecordItem = ({ doc, onRefresh, existingRecords }: { doc: any; onRefresh: () => void; existingRecords: any[] }) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [newTitle, setNewTitle] = useState(doc.title);

    const handleDelete = () => {
        Alert.alert("Delete Record", "Are you sure you want to delete this medical record?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        const token = await AsyncStorage.getItem('userToken');
                        const res = await fetch(`${API_URL}/subscriber/beneficiaries/medical-records/${doc.id}`, { 
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            Alert.alert("Deleted", "Record removed successfully.");
                            onRefresh();
                        }
                    } catch (e) {
                        Alert.alert("Error", "Failed to delete record.");
                    }
                }
            }
        ]);
    };

    const handleRename = async () => {
        if (!newTitle.trim()) {
            Alert.alert("Input required", "Please enter a name for the document.");
            return;
        }

        const isDuplicate = existingRecords.some(
            (r: any) => r.id !== doc.id && r.title.toLowerCase() === newTitle.trim().toLowerCase()
        );
        if (isDuplicate) {
            Alert.alert("Duplicate Name", "A document with this name already exists. Please choose a unique name.");
            return;
        }

        try {
            const token = await AsyncStorage.getItem('userToken');
            const res = await fetch(`${API_URL}/subscriber/beneficiaries/medical-records/${doc.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: newTitle.trim() })
            });
            if (res.ok) {
                Alert.alert("Success", "Record renamed.");
                setIsRenaming(false);
                onRefresh();
            }
        } catch (e) {
            Alert.alert("Error", "Failed to rename record.");
        }
    };

    const handleViewDocument = async () => {
        try {
            // First attempt: fetch temporary signed URL from secure backend endpoint
            const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('userToken');
            const res = await fetch(`${API_URL}/files/presigned?type=medical_record&id=${doc.id}`, {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            const data = await res.json();
            if (data?.success && data?.url) {
                await WebBrowser.openBrowserAsync(data.url);
                return;
            }
        } catch (error) {
            console.warn('Presigned URL fetch failed, trying direct fileUrl fallback:', error);
        }

        if (doc.fileUrl) {
            try {
                await WebBrowser.openBrowserAsync(doc.fileUrl);
            } catch (error) {
                Alert.alert("Error", "Could not open document.");
            }
        } else {
            Alert.alert("Unavailable", "This document does not have a valid link.");
        }
    };

    return (
        <View>
            <TouchableOpacity style={styles.docRow} onPress={handleViewDocument} activeOpacity={0.7}>
                <Ionicons name="document-text" size={scale(24)} color="#F97316" />
                <View style={{ flex: 1, marginLeft: scale(12) }}>
                    <Text style={styles.docTitle}>{doc.title}</Text>
                    <Text style={styles.docMeta}>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: scale(12) }}>
                    <TouchableOpacity onPress={() => setIsRenaming(true)}>
                        <Ionicons name="pencil-outline" size={scale(18)} color="#9CA3AF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={scale(18)} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {/* Rename Modal */}
            <Modal visible={isRenaming} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rename Record</Text>
                        <TextInput 
                            style={styles.modalInput} 
                            value={newTitle} 
                            onChangeText={setNewTitle}
                            autoFocus
                        />
                        <TouchableOpacity style={styles.modalBtn} onPress={handleRename}>
                            <Text style={styles.modalBtnText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setIsRenaming(false)} style={{ marginTop: scale(10), alignItems: 'center' }}>
                            <Text style={{ color: '#6B7280' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export const MedicalTab = ({ beneficiary, conditions, onRefresh }: { beneficiary: any, conditions: string[], onRefresh: () => void }) => {
    const [uploading, setUploading] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<any>(null);
    const [docName, setDocName] = useState("");
    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);

    // Medication state
    const [isMedModalVisible, setIsMedModalVisible] = useState(false);
    const [addingMed, setAddingMed] = useState(false);

    const handlePickDocument = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
                copyToCacheDirectory: true,
            });

            if (res.canceled) return;

            const asset = res.assets[0];
            setSelectedAsset(asset);
            const cleanName = asset.name.split('.').slice(0, -1).join('.') || asset.name;
            setDocName(cleanName);
            setIsUploadModalVisible(true);
        } catch (e: any) {
            console.error("Document picking error:", e);
            Alert.alert("Error", "Failed to select document.");
        }
    };

    const handleConfirmUpload = async () => {
        if (!selectedAsset) return;
        if (!docName.trim()) {
            Alert.alert("Input required", "Please enter a name for the document.");
            return;
        }

        const isDuplicate = (beneficiary.medicalRecords || []).some(
            (r: any) => r.title.toLowerCase() === docName.trim().toLowerCase()
        );
        if (isDuplicate) {
            Alert.alert("Duplicate Name", "A document with this name already exists. Please choose a unique name.");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();

            if (Platform.OS === 'web') {
                const blobResponse = await fetch(selectedAsset.uri);
                const blob = await blobResponse.blob();
                formData.append('file', blob, selectedAsset.name);
            } else {
                formData.append('file', {
                    uri: selectedAsset.uri,
                    name: selectedAsset.name,
                    type: selectedAsset.mimeType || 'application/octet-stream',
                } as any);
            }

            formData.append('title', docName.trim());

            const token = await AsyncStorage.getItem('userToken');
            const uploadRes = await fetch(`${API_URL}/subscriber/beneficiaries/${beneficiary.id}/medical-records/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
                body: formData,
            });

            const data = await uploadRes.json();
            if (data.success) {
                Alert.alert("Success", "Document uploaded successfully.");
                setIsUploadModalVisible(false);
                setSelectedAsset(null);
                setDocName("");
                onRefresh();
            } else {
                Alert.alert("Error", data.message || "Failed to upload document.");
            }
        } catch (e: any) {
            console.error("Upload error:", e);
            Alert.alert("Error", "Failed to upload document.");
        } finally {
            setUploading(false);
        }
    };

    const formatFrequency = (freq?: string) => {
        if (!freq) return 'Once Daily';
        switch (freq) {
            case 'once_daily': return 'Once Daily';
            case 'twice_daily': return 'Twice Daily';
            case 'thrice_daily': return 'Thrice Daily';
            case 'four_times_daily': return '4 Times Daily';
            case 'as_needed': return 'As Needed';
            case 'weekly': return 'Weekly';
            default: return freq.replace(/_/g, ' ');
        }
    };

    const handleAddMedication = async (medData: MedicationFormData) => {
        try {
            setAddingMed(true);
            const token = await AsyncStorage.getItem('userToken');
            const res = await fetch(`${API_URL}/subscriber/beneficiaries/${beneficiary.id}/medications`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: medData.name.trim(),
                    dosage: medData.dosage?.trim() || 'Take as directed',
                    frequency: medData.frequency || 'twice_daily',
                    instructions: medData.instructions?.trim() || undefined,
                    startDate: medData.startDate || undefined,
                    endDate: medData.endDate || undefined,
                })
            });

            const data = await res.json();
            if (data.success) {
                Alert.alert("Success", "Medication added successfully.");
                setIsMedModalVisible(false);
                onRefresh();
            } else {
                Alert.alert("Error", data.message || "Failed to add medication.");
            }
        } catch (e) {
            console.error("Error adding medication:", e);
            Alert.alert("Error", "Failed to add medication.");
        } finally {
            setAddingMed(false);
        }
    };

    const handleDeleteMedication = (medId: string, medName: string) => {
        Alert.alert("Remove Medication", `Are you sure you want to remove ${medName} from ongoing medications?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                    try {
                        const token = await AsyncStorage.getItem('userToken');
                        const res = await fetch(`${API_URL}/subscriber/beneficiaries/medications/${medId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            Alert.alert("Removed", "Medication removed from active list.");
                            onRefresh();
                        }
                    } catch (e) {
                        Alert.alert("Error", "Failed to remove medication.");
                    }
                }
            }
        ]);
    };

    return (
        <View style={{ paddingHorizontal: scale(20) }}>
            {/* Medical Conditions */}
            <View style={styles.medCard}>
                <Text style={styles.medCardTitle}>Medical Conditions</Text>
                <View style={styles.conditionsBox}>
                    {conditions.map((c: string, i: number) => (
                        <View key={i} style={styles.conditionRow}>
                            <View style={styles.dot} />
                            <Text style={styles.condTagLargeText}>{c}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Current Vitals (Summary Grid in medical tab as per UI) */}
            <View style={styles.medCard}>
                <Text style={styles.medCardTitle}>Current Vitals</Text>
                <View style={styles.miniVitalsGrid}>
                    {beneficiary.vitalsData?.map((v: any, i: number) => (
                        <View key={i} style={[styles.miniVitalItem, { backgroundColor: getVitalColor(v.label, i) }]}>
                            <Text style={styles.miniVitalLabel}>{v.label}</Text>
                            <Text style={styles.miniVitalValue}>{v.value}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Medical Records */}
            <View style={styles.medCard}>
                <Text style={styles.medCardTitle}>Medical Records</Text>
                {beneficiary.medicalRecords?.length > 0 ? (
                    <>
                        {beneficiary.medicalRecords.map((doc: any, i: number) => (
                            <MedicalRecordItem key={doc.id || i} doc={doc} onRefresh={onRefresh} existingRecords={beneficiary.medicalRecords || []} />
                        ))}
                        <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument} disabled={uploading}>
                            <Text style={styles.uploadBtnText}>{uploading ? "Uploading..." : "Upload Documents"}</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.emptyRecordsBox}>
                        <Ionicons name="document-text-outline" size={scale(28)} color="#9CA3AF" />
                        <Text style={styles.emptyRecordsText}>No medical records uploaded yet</Text>
                        <TouchableOpacity style={styles.uploadBtnSmall} onPress={handlePickDocument} disabled={uploading}>
                            <Text style={styles.uploadBtnTextSmall}>{uploading ? "Uploading..." : "Upload Documents"}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Name Document Modal */}
                <Modal visible={isUploadModalVisible} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Name Document</Text>
                            <TextInput 
                                style={styles.modalInput} 
                                value={docName} 
                                onChangeText={setDocName}
                                placeholder="Enter document name"
                                placeholderTextColor="#9CA3AF"
                                autoFocus
                            />
                            <TouchableOpacity style={styles.modalBtn} onPress={handleConfirmUpload} disabled={uploading}>
                                <Text style={styles.modalBtnText}>{uploading ? "Uploading..." : "Upload"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setIsUploadModalVisible(false); setSelectedAsset(null); }} style={{ marginTop: scale(10), alignItems: 'center' }}>
                                <Text style={{ color: '#6B7280' }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
            
            {/* Medications Card */}
            <View style={styles.medCard}>
                <View style={styles.medCardHeaderRow}>
                    <Text style={styles.medCardTitle}>Current Medications</Text>
                    <TouchableOpacity 
                        style={styles.addMedBtn} 
                        onPress={() => setIsMedModalVisible(true)}
                    >
                        <Ionicons name="add-circle" size={scale(18)} color="#F97316" />
                        <Text style={styles.addMedBtnText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {beneficiary.medicationList?.length > 0 ? (
                    beneficiary.medicationList.map((m: any, i: number) => (
                        <View key={m.id || i} style={styles.medRowItem}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.medNameText}>
                                    • {m.name} <Text style={styles.medDosageText}>{m.dosage}</Text>
                                </Text>
                                <Text style={styles.medSubDetail}>
                                    Frequency: {formatFrequency(m.frequency)} {m.instructions ? `• ${m.instructions}` : ''}
                                </Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => handleDeleteMedication(m.id, m.name)}
                                style={styles.trashBtn}
                            >
                                <Ionicons name="trash-outline" size={scale(18)} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    ))
                ) : (
                    <Text style={styles.medValue}>No active medications.</Text>
                )}
            </View>

            {/* Add Medication Modal */}
            <AddMedicineModal
                visible={isMedModalVisible}
                onClose={() => setIsMedModalVisible(false)}
                onSave={handleAddMedication}
                loading={addingMed}
            />

            {/* Physician & Hobbies */}
            <View style={styles.medCard}>
                <Text style={styles.medCardTitle}>Primary Physician</Text>
                <Text style={styles.medValue}>{beneficiary.primaryPhysicianName || 'Not specified'}</Text>
                <Text style={styles.medSubValue}>{beneficiary.primaryPhysicianPhone || ''} {beneficiary.primaryPhysicianSpec ? `(${beneficiary.primaryPhysicianSpec})` : ''}</Text>
            </View>
            <View style={styles.medCard}>
                <Text style={styles.medCardTitle}>Hobbies & Interests</Text>
                <Text style={styles.medValue}>{beneficiary.hobbiesInterests?.join(', ') || 'Not specified'}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    medCard: {
        marginBottom: scale(24),
    },
    medCardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(12),
    },
    medCardTitle: { fontSize: scale(16), fontWeight: '500', color: '#111827', marginBottom: scale(12) },
    addMedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(4),
        backgroundColor: '#FFF5ED',
        paddingHorizontal: scale(10),
        paddingVertical: scale(5),
        borderRadius: scale(8),
    },
    addMedBtnText: {
        fontSize: scale(13),
        fontWeight: '700',
        color: '#F97316',
    },
    medRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(8),
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    medNameText: {
        fontSize: scale(15),
        fontWeight: '700',
        color: '#111827',
    },
    medDosageText: {
        fontWeight: '500',
        color: '#4B5563',
    },
    medSubDetail: {
        fontSize: scale(12),
        color: '#6B7280',
        marginTop: scale(2),
    },
    trashBtn: {
        padding: scale(6),
        marginLeft: scale(8),
    },
    inputLabel: {
        fontSize: scale(13),
        fontWeight: '600',
        color: '#374151',
        marginBottom: scale(6),
    },
    freqPillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(8),
        marginBottom: scale(16),
    },
    freqPill: {
        paddingHorizontal: scale(12),
        paddingVertical: scale(8),
        borderRadius: scale(8),
        backgroundColor: '#F3F4F6',
    },
    freqPillActive: {
        backgroundColor: '#F97316',
    },
    freqPillText: {
        fontSize: scale(12),
        fontWeight: '600',
        color: '#4B5563',
    },
    freqPillTextActive: {
        color: '#FFFFFF',
    },

    conditionsBox: { backgroundColor: '#FFF0E5', borderRadius: scale(12), padding: scale(16) },
    conditionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(8) },
    dot: { width: scale(6), height: scale(6), borderRadius: scale(3), backgroundColor: '#F97316', marginRight: scale(10) },
    condTagLargeText: { fontSize: scale(14), color: '#111827', fontWeight: '400' },
    
    miniVitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10) },
    miniVitalItem: { width: '48%', padding: scale(14), borderRadius: scale(12) },
    miniVitalLabel: { fontSize: scale(12), color: '#4B5563', marginBottom: scale(8) },
    miniVitalValue: { fontSize: scale(20), fontWeight: '600', color: '#111827' },

    docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: scale(12), borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    docTitle: { fontSize: scale(14), fontWeight: '600', color: '#111827' },
    docMeta: { fontSize: scale(12), color: '#9CA3AF', marginTop: scale(2) },
    emptyRecordsBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#9CA3AF', borderRadius: scale(12), alignItems: 'center', paddingVertical: scale(30), backgroundColor: '#FFF' },
    emptyRecordsText: { fontSize: scale(14), color: '#111827', marginTop: scale(12), marginBottom: scale(20) },
    uploadBtnSmall: { backgroundColor: '#F97316', borderRadius: scale(8), paddingHorizontal: scale(20), paddingVertical: scale(10) },
    uploadBtnTextSmall: { color: '#FFF', fontWeight: '600', fontSize: scale(14) },
    uploadBtn: { backgroundColor: '#F97316', borderRadius: scale(12), height: scale(44), justifyContent: 'center', alignItems: 'center', marginTop: scale(15) },
    uploadBtnText: { color: '#FFF', fontWeight: '600', fontSize: scale(14) },

    medValue: { fontSize: scale(14), color: '#111827', lineHeight: scale(22) },
    medSubValue: { fontSize: scale(13), color: '#6B7280', marginTop: scale(4) },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: scale(20) },
    modalContent: { backgroundColor: '#FFF', borderRadius: scale(20), padding: scale(24) },
    modalTitle: { fontSize: scale(18), fontWeight: '700', marginBottom: scale(20) },
    modalInput: { backgroundColor: '#F9FAFB', borderRadius: scale(10), padding: scale(14), marginBottom: scale(16), borderWidth: 1, borderColor: '#E5E7EB' },
    modalBtn: { backgroundColor: '#F97316', padding: scale(14), borderRadius: scale(10), alignItems: 'center' },
    modalBtnText: { color: '#FFF', fontWeight: '700' },
});

export default MedicalTab;
