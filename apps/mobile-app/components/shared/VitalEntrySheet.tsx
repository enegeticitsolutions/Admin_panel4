/**
 * VitalEntrySheet — Global reusable component for beneficiary self-reported vitals.
 *
 * Props:
 *   authToken  — JWT token for API calls
 *   onSuccess  — called after successful submission
 *   onClose    — called when user presses Cancel / Back
 *
 * Fetches the beneficiary's assigned vital definitions dynamically,
 * renders the appropriate inputs (numeric / dual_numeric / boolean / text chips),
 * and posts the readings to POST /beneficiary/medical-records/vitals.
 *
 * Source is automatically set to "beneficiary" by the backend.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VitalDefinition {
    id: string;
    code: string;
    name: string;
    unit: string | null;
    dataType: 'numeric' | 'dual_numeric' | 'boolean' | 'text';
    iconCode: string | null;
    displayOrder: number;
    normalMin: number | null;
    normalMax: number | null;
    normalMin2: number | null;
    normalMax2: number | null;
    value1Label: string | null;
    value2Label: string | null;
    booleanTrueLabel: string | null;
    booleanFalseLabel: string | null;
    options: string[] | null; // text options chips
}

interface VitalEntry {
    valueNumeric: string;
    valueNumeric2: string;
    valueText: string;
}

interface Props {
    authToken: string;
    beneficiaryId?: string;
    onSuccess: () => void;
    onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const VitalEntrySheet: React.FC<Props> = ({ authToken, beneficiaryId, onSuccess, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [definitions, setDefinitions] = useState<VitalDefinition[]>([]);
    const [values, setValues] = useState<Record<string, VitalEntry>>({});
    const [error, setError] = useState<string | null>(null);

    // Fetch vital definitions on mount
    useEffect(() => {
        fetchDefinitions();
    }, [authToken, beneficiaryId]);

    const fetchDefinitions = async () => {
        try {
            setLoading(true);
            setError(null);
            const query = beneficiaryId ? `?beneficiaryId=${encodeURIComponent(beneficiaryId)}` : '';
            const res = await fetch(`${API_URL}/beneficiary/medical-records/vital-definitions${query}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setDefinitions(data.data);
                // Initialise empty entries
                const init: Record<string, VitalEntry> = {};
                data.data.forEach((d: VitalDefinition) => {
                    init[d.id] = { valueNumeric: '', valueNumeric2: '', valueText: '' };
                });
                setValues(init);
            } else {
                setError('Could not load vital fields. Please try again.');
            }
        } catch (e) {
            setError('Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const updateValue = useCallback((id: string, field: keyof VitalEntry, val: string) => {
        setValues(prev => ({
            ...prev,
            [id]: { ...(prev[id] || { valueNumeric: '', valueNumeric2: '', valueText: '' }), [field]: val },
        }));
    }, []);

    const handleSubmit = async () => {
        // Build list — skip completely empty entries
        const vitalsList = definitions
            .map(def => {
                const entry = values[def.id] || { valueNumeric: '', valueNumeric2: '', valueText: '' };
                const payload: any = { vitalDefinitionId: def.id };

                if (def.dataType === 'numeric' && entry.valueNumeric.trim()) {
                    payload.valueNumeric = parseFloat(entry.valueNumeric);
                } else if (def.dataType === 'dual_numeric' && (entry.valueNumeric.trim() || entry.valueNumeric2.trim())) {
                    if (entry.valueNumeric.trim()) payload.valueNumeric = parseFloat(entry.valueNumeric);
                    if (entry.valueNumeric2.trim()) payload.valueNumeric2 = parseFloat(entry.valueNumeric2);
                } else if (def.dataType === 'boolean' && entry.valueText) {
                    payload.valueBoolean = entry.valueText === 'yes';
                } else if (def.dataType === 'text' && entry.valueText.trim()) {
                    payload.valueText = entry.valueText.trim();
                } else {
                    return null; // skip empty
                }
                return payload;
            })
            .filter(Boolean);

        if (vitalsList.length === 0) {
            if (Platform.OS === 'web') {
                window.alert('Please fill in at least one vital before saving.');
            } else {
                Alert.alert('No Vitals Entered', 'Please fill in at least one vital before saving.');
            }
            return;
        }

        try {
            setSubmitting(true);
            const res = await fetch(`${API_URL}/beneficiary/medical-records/vitals`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    vitalsList,
                    ...(beneficiaryId ? { beneficiaryId } : {}),
                }),
            });
            const data = await res.json();
            if (data.success) {
                if (Platform.OS === 'web') {
                    window.alert('✅ Vitals Saved! Your health readings have been successfully recorded.');
                    onSuccess();
                } else {
                    Alert.alert('Vitals Recorded', 'Your health readings have been successfully saved.', [
                        { text: 'OK', onPress: onSuccess }
                    ]);
                }
            } else {
                if (Platform.OS === 'web') {
                    window.alert('Error: ' + (data.message || 'Could not save vitals.'));
                } else {
                    Alert.alert('Error', data.message || 'Could not save vitals.');
                }
            }
        } catch (e) {
            if (Platform.OS === 'web') {
                window.alert('Network error. Please try again.');
            } else {
                Alert.alert('Error', 'Network error. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ── Loading ──────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#FF6900" />
                <Text style={styles.loadingText}>Loading vitals...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={fetchDefinitions}>
                    <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (definitions.length === 0) {
        return (
            <View style={styles.center}>
                <MaterialCommunityIcons name="clipboard-alert-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyText}>No vitals configured for your profile yet.</Text>
                <Text style={styles.emptySubText}>Your care plan will be updated soon.</Text>
            </View>
        );
    }

    // ── Render each vital input ───────────────────────────────────────────────

    const renderVitalInput = (def: VitalDefinition) => {
        const entry = values[def.id] || { valueNumeric: '', valueNumeric2: '', valueText: '' };

        if (def.dataType === 'numeric') {
            return (
                <View key={def.id} style={styles.vitalBlock}>
                    <Text style={styles.vitalLabel}>
                        {def.name}{def.unit ? ` (${def.unit})` : ''}
                    </Text>
                    <TextInput
                        style={styles.input}
                        placeholder={`Enter value${def.normalMin != null ? `, normal ${def.normalMin}–${def.normalMax}` : ''}`}
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        returnKeyType="next"
                        value={entry.valueNumeric}
                        onChangeText={t => updateValue(def.id, 'valueNumeric', t)}
                    />
                </View>
            );
        }

        if (def.dataType === 'dual_numeric') {
            return (
                <View key={def.id} style={styles.vitalBlock}>
                    <Text style={styles.vitalLabel}>
                        {def.name}{def.unit ? ` (${def.unit})` : ''}
                    </Text>
                    <View style={styles.dualRow}>
                        <View style={styles.dualCol}>
                            <Text style={styles.subLabel}>{def.value1Label || 'Systolic'}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 120"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="numeric"
                                returnKeyType="next"
                                value={entry.valueNumeric}
                                onChangeText={t => updateValue(def.id, 'valueNumeric', t)}
                            />
                        </View>
                        <View style={styles.dualSep}>
                            <Text style={styles.dualSepText}>/</Text>
                        </View>
                        <View style={styles.dualCol}>
                            <Text style={styles.subLabel}>{def.value2Label || 'Diastolic'}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 80"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="numeric"
                                returnKeyType="next"
                                value={entry.valueNumeric2}
                                onChangeText={t => updateValue(def.id, 'valueNumeric2', t)}
                            />
                        </View>
                    </View>
                </View>
            );
        }

        if (def.dataType === 'boolean') {
            const selected = entry.valueText;
            return (
                <View key={def.id} style={styles.vitalBlock}>
                    <Text style={styles.vitalLabel}>{def.name}</Text>
                    <View style={styles.boolRow}>
                        <TouchableOpacity
                            style={[styles.boolBtn, selected === 'yes' && styles.boolBtnActive]}
                            onPress={() => updateValue(def.id, 'valueText', 'yes')}
                        >
                            <Text style={[styles.boolBtnText, selected === 'yes' && styles.boolBtnTextActive]}>
                                {def.booleanTrueLabel || 'Yes'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.boolBtn, selected === 'no' && styles.boolBtnActive]}
                            onPress={() => updateValue(def.id, 'valueText', 'no')}
                        >
                            <Text style={[styles.boolBtnText, selected === 'no' && styles.boolBtnTextActive]}>
                                {def.booleanFalseLabel || 'No'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        if (def.dataType === 'text') {
            const opts = def.options || [];
            const selected = entry.valueText;
            return (
                <View key={def.id} style={styles.vitalBlock}>
                    <Text style={styles.vitalLabel}>{def.name}</Text>
                    <View style={styles.chipRow}>
                        {opts.map(opt => {
                            const isActive = selected === opt;
                            return (
                                <TouchableOpacity
                                    key={opt}
                                    style={[styles.chip, isActive && styles.chipActive]}
                                    onPress={() => updateValue(def.id, 'valueText', isActive ? '' : opt)}
                                >
                                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{opt}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            );
        }

        return null;
    };

    // ── Main render ──────────────────────────────────────────────────────────

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerIcon}>
                    <Ionicons name="pulse-outline" size={20} color="#FF6900" />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Record Vitals</Text>
                    <Text style={styles.headerSub}>Enter your current health readings</Text>
                </View>
            </View>

            {/* Info banner */}
            <View style={styles.banner}>
                <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
                <Text style={styles.bannerText}>These readings will be marked as self-reported.</Text>
            </View>

            {/* Vital inputs */}
            {definitions.map(renderVitalInput)}

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={styles.saveBtnText}>Save Vitals</Text>
                    }
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
    loadingText: { fontSize: 14, color: '#6B7280', marginTop: 8 },
    errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center' },
    emptyText: { fontSize: 15, fontWeight: '600', color: '#374151', textAlign: 'center' },
    emptySubText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
    retryBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: '#FEF2ED', borderRadius: 12 },
    retryBtnText: { color: '#FF6900', fontWeight: '700' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerIcon: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: '#FEF2ED',
        justifyContent: 'center', alignItems: 'center',
    },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
    headerSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },

    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EFF6FF',
        borderRadius: 10,
        padding: 10,
        marginBottom: 20,
    },
    bannerText: { fontSize: 12, color: '#3B82F6', flex: 1 },

    vitalBlock: {
        marginBottom: 20,
        backgroundColor: '#F9FAFB',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    vitalLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },

    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: '#111827',
    },

    dualRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 0 },
    dualCol: { flex: 1 },
    dualSep: { paddingHorizontal: 8, paddingBottom: 10 },
    dualSepText: { fontSize: 18, fontWeight: '300', color: '#9CA3AF' },
    subLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

    boolRow: { flexDirection: 'row', gap: 10 },
    boolBtn: {
        flex: 1, paddingVertical: 12, borderRadius: 12,
        backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    boolBtnActive: { backgroundColor: '#FF6900', borderColor: '#FF6900' },
    boolBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    boolBtnTextActive: { color: '#FFFFFF' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingVertical: 8, paddingHorizontal: 14,
        borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    chipActive: { backgroundColor: '#FF6900', borderColor: '#FF6900' },
    chipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
    chipTextActive: { color: '#FFFFFF' },

    actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 14,
        backgroundColor: '#F3F4F6', alignItems: 'center',
    },
    cancelBtnText: { fontSize: 15, fontWeight: '700', color: '#6B7280' },
    saveBtn: {
        flex: 2, paddingVertical: 14, borderRadius: 14,
        backgroundColor: '#FF6900', alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#FF6900', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
            android: { elevation: 4 },
        }),
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});

export default VitalEntrySheet;
