import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions, Modal, TextInput, Alert, KeyboardAvoidingView, RefreshControl } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useGlobalRefresh, emitGlobalRefresh } from '@/utils/events';
import { useAuth } from '@/contexts/AuthContext';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { format } from 'date-fns';


type Visit = {
    id: string;
    title: string;
    date: string;
    time: string;
    duration: string;
    companionName: string;
    type: string;
    status: string;
    changeRequestedAt?: string;
    changeRequestStatus?: string;
    changeResolutionReason?: string;
    rawScheduledTime?: string;
};

export default function ScheduleScreen() {
    const { width } = useWindowDimensions();
    const MAX_CONTENT_WIDTH = 440;
    const responsiveStyle = { width: '100%' as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const };

    const router = useRouter();
    const { push, replace, pop } = useNavigationStack();
    const safeBack = useSafeBack();
    useAndroidBackHandler();

    const { isGuest, isLoggedIn, isLoading: authLoading } = useAuth();
    const [isUnauthenticated, setIsUnauthenticated] = useState(false);
    const [upcomingVisits, setUpcomingVisits] = useState<Visit[]>([]);
    const [pastVisits, setPastVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [isModalVisible, setModalVisible] = useState(false);
    const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
    const [preferredDate, setPreferredDate] = useState('');
    const [preferredTime, setPreferredTime] = useState('');
    const [changeReason, setChangeReason] = useState('');
    const [submittingChange, setSubmittingChange] = useState(false);

    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [isTimePickerVisible, setTimePickerVisibility] = useState(false);

    const handleConfirmDate = (date: Date) => {
        setPreferredDate(format(date, 'MMM d, yyyy'));
        setDatePickerVisibility(false);
    };

    const handleConfirmTime = (time: Date) => {
        setPreferredTime(format(time, 'h:mm a'));
        setTimePickerVisibility(false);
    };

    useFocusEffect(
        useCallback(() => {
            if (authLoading) return;
            if (isGuest || !isLoggedIn) {
                setIsUnauthenticated(true);
                setLoading(false);
            } else {
                fetchVisits();
            }
        }, [authLoading, isGuest, isLoggedIn])
    );

    useGlobalRefresh(() => {
        if (!isGuest && isLoggedIn) {
            fetchVisits();
        }
    });

    const onRefresh = useCallback(async () => {
        if (isGuest || !isLoggedIn) return;
        setRefreshing(true);
        await fetchVisits();
        setRefreshing(false);
    }, [isGuest, isLoggedIn]);

    const fetchVisits = async () => {
        if (isGuest || !isLoggedIn) {
            setIsUnauthenticated(true);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const token = await AsyncStorage.getItem('userToken');
            const userStr = await AsyncStorage.getItem('userData');

            if (!token || !userStr) {
                setIsUnauthenticated(true);
                setLoading(false);
                return;
            }

            setIsUnauthenticated(false);
            const user = JSON.parse(userStr);
            const beneficiaryId = user.id;

            const response = await fetch(`${API_URL}/beneficiary/${beneficiaryId}/visits`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const data = await response.json();
            if (data.success) {
                setUpcomingVisits(data.data.upcoming || []);
                setPastVisits(data.data.past || []);
            } else {
                setError(data.message || 'Failed to fetch schedules');
            }
        } catch (e: any) {
            console.error('Fetch Visits Error:', e);
            setError('An error occurred while loading your schedule. Please check your connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestChangePress = (visit: Visit) => {
        if (!visit.rawScheduledTime) {
            Alert.alert("Error", "Could not verify scheduled time.");
            return;
        }

        const now = new Date();
        const scheduledTime = new Date(visit.rawScheduledTime);
        const diffHours = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (diffHours < 48) {
            Alert.alert("Cannot Request Change", "Requests to change a visit must be made at least 48 hours in advance. Please contact support.");
            return;
        }

        setSelectedVisitId(visit.id);
        setPreferredDate('');
        setPreferredTime('');
        setChangeReason('');
        setModalVisible(true);
    };

    const submitChangeRequest = async () => {
        if (!preferredDate || !preferredTime || !changeReason) {
            Alert.alert("Error", "Please fill out all fields.");
            return;
        }

        if (!selectedVisitId) return;

        setSubmittingChange(true);
        try {
            const token = await AsyncStorage.getItem('userToken');
            const response = await fetch(`${API_URL}/beneficiary/visits/${selectedVisitId}/request-change`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    preferredDate,
                    preferredTime,
                    reason: changeReason
                }),
            });

            const data = await response.json();
            if (data.success) {
                Alert.alert("Success", "Your change request has been submitted.");
                setModalVisible(false);
                fetchVisits(); // Refresh data
                emitGlobalRefresh();
            } else {
                Alert.alert("Error", data.message || "Failed to submit request.");
            }
        } catch (e) {
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setSubmittingChange(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Top Navigation Bar */}
            <View style={styles.navBar}>
                <TouchableOpacity
                    onPress={() => safeBack('/(beneficiary)')}
                    style={styles.navBarBackBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Feather name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.navBarTitle}>Visit Schedule</Text>
            </View>

            {loading || authLoading ? (
                <View style={[styles.centerContainer, responsiveStyle]}>
                    <ActivityIndicator size="large" color="#FE6700" />
                    <Text style={styles.loaderText}>Loading schedule...</Text>
                </View>
            ) : isUnauthenticated || isGuest || !isLoggedIn ? (
                <ScrollView 
                    contentContainerStyle={[styles.guestContent, responsiveStyle]} 
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.guestCard}>
                        {/* Care Schedule Badge */}
                        <View style={styles.guestBadge}>
                            <Feather name="calendar" size={13} color="#FE6700" />
                            <Text style={styles.guestBadgeText}>Saathi Care Visits</Text>
                        </View>

                        {/* Icon Wrap */}
                        <View style={styles.guestIconWrap}>
                            <MaterialCommunityIcons name="calendar-clock" size={42} color="#FE6700" />
                        </View>

                        <Text style={styles.guestTitle}>Track Every Care Visit</Text>
                        <Text style={styles.guestDesc}>
                            Create an account or sign in to view scheduled visits with your verified Saathi care companions, track live appointments, and reschedule anytime.
                        </Text>

                        {/* Feature Highlights */}
                        <View style={styles.guestFeatureList}>
                            <View style={styles.guestFeatureRow}>
                                <Feather name="check-circle" size={16} color="#10B981" />
                                <Text style={styles.guestFeatureText}>Scheduled Saathi companion visits & reminders</Text>
                            </View>
                            <View style={styles.guestFeatureRow}>
                                <Feather name="check-circle" size={16} color="#10B981" />
                                <Text style={styles.guestFeatureText}>Live visit status & companion arrival times</Text>
                            </View>
                            <View style={styles.guestFeatureRow}>
                                <Feather name="check-circle" size={16} color="#10B981" />
                                <Text style={styles.guestFeatureText}>Easy 1-tap visit rescheduling & special requests</Text>
                            </View>
                            <View style={styles.guestFeatureRow}>
                                <Feather name="check-circle" size={16} color="#10B981" />
                                <Text style={styles.guestFeatureText}>Complete history of past care notes & summaries</Text>
                            </View>
                        </View>

                        {/* CTA Buttons */}
                        <TouchableOpacity
                            style={styles.guestPrimaryBtn}
                            onPress={() => router.push('/(auth)/register')}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.guestPrimaryBtnText}>Create Account</Text>
                            <Feather name="arrow-right" size={18} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.guestSecondaryBtn}
                            onPress={() => router.push('/(auth)')}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.guestSecondaryBtnText}>
                                Already have an account? <Text style={styles.guestSecondaryLink}>Sign In</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            ) : error ? (
                <View style={[styles.centerContainer, responsiveStyle]}>
                    <View style={styles.errorIconWrap}>
                        <Feather name="alert-circle" size={36} color="#D97706" />
                    </View>
                    <Text style={styles.errorTitle}>Unable to Load Schedule</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchVisits} activeOpacity={0.85}>
                        <Feather name="refresh-cw" size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.retryText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView 
                    contentContainerStyle={[styles.content, responsiveStyle]} 
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FE6700" />}
                >

                    {/* Upcoming Visits Section */}
                    <Text style={styles.sectionHeader}>Upcoming Visits</Text>
                    {upcomingVisits.length > 0 ? (
                        upcomingVisits.map(visit => (
                            <View key={visit.id} style={styles.card}>
                                {/* Upcoming green badge */}
                                <View style={styles.badgeUpcoming}>
                                    <Text style={styles.badgeUpcomingText}>Upcoming</Text>
                                </View>

                                {/* Visit Title */}
                                <Text style={styles.visitTitle}>{visit.title}</Text>

                                {/* Icon-based Details */}
                                <View style={styles.detailsContainer}>
                                    <View style={styles.detailRow}>
                                        <Feather name="calendar" size={16} color="#6B7280" style={styles.detailIcon} />
                                        <Text style={styles.detailText}>{visit.date}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Feather name="clock" size={16} color="#6B7280" style={styles.detailIcon} />
                                        <Text style={styles.detailText}>{visit.time} ({visit.duration})</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Feather name="user" size={16} color="#6B7280" style={styles.detailIcon} />
                                        <Text style={styles.detailText}>{visit.companionName}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Feather name="map-pin" size={16} color="#6B7280" style={styles.detailIcon} />
                                        <Text style={styles.detailText}>{visit.type}</Text>
                                    </View>
                                </View>

                                {/* Request Change Action Button / Status */}
                                {visit.changeRequestStatus === 'rejected' ? (
                                    <View style={styles.rejectionAlert}>
                                        <Feather name="alert-circle" size={16} color="#DC2626" style={{marginRight: 6}} />
                                        <View style={{flex: 1}}>
                                            <Text style={styles.rejectionTitle}>Change Request Rejected</Text>
                                            {visit.changeResolutionReason && (
                                                <Text style={styles.rejectionReason}>"{visit.changeResolutionReason}"</Text>
                                            )}
                                        </View>
                                    </View>
                                ) : visit.changeRequestStatus === 'accepted' ? (
                                    <View style={styles.acceptedAlert}>
                                        <Feather name="check-circle" size={16} color="#059669" style={{marginRight: 6}} />
                                        <Text style={styles.acceptedText}>Change Request Approved</Text>
                                    </View>
                                ) : (visit.changeRequestStatus === 'pending' && visit.changeRequestedAt) ? (
                                    <View style={styles.requestButtonDisabled}>
                                        <Feather name="clock" size={16} color="#9CA3AF" style={{marginRight: 6}} />
                                        <Text style={styles.requestButtonTextDisabled}>Change Pending</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity 
                                        style={styles.requestButton} 
                                        activeOpacity={0.7}
                                        onPress={() => handleRequestChangePress(visit)}
                                    >
                                        <Text style={styles.requestButtonText}>Request Change</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Feather name="calendar" size={40} color="#9CA3AF" />
                            <Text style={styles.emptySubtitle}>No upcoming visits scheduled.</Text>
                        </View>
                    )}

                    {/* Past Visits Section */}
                    <Text style={[styles.sectionHeader, { marginTop: 24 }]}>Past Visits</Text>
                    {pastVisits.length > 0 ? (
                        pastVisits.map(visit => (
                            <TouchableOpacity
                                key={visit.id}
                                style={styles.card}
                                activeOpacity={0.7}
                                onPress={() => push({
                                    pathname: '/(beneficiary)/interactions',
                                    params: { visitId: visit.id }
                                })}
                            >
                                {/* Completed gray badge */}
                                <View style={styles.badgeCompleted}>
                                    <Text style={styles.badgeCompletedText}>Completed</Text>
                                </View>

                                {/* Visit Title */}
                                <Text style={styles.visitTitle}>{visit.title}</Text>

                                {/* Icon-based Details */}
                                <View style={styles.detailsContainer}>
                                    <View style={styles.detailRow}>
                                        <Feather name="calendar" size={16} color="#6B7280" style={styles.detailIcon} />
                                        <Text style={styles.detailText}>{visit.date}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Feather name="user" size={16} color="#6B7280" style={styles.detailIcon} />
                                        <Text style={styles.detailText}>{visit.companionName}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Feather name="clock" size={40} color="#9CA3AF" />
                            <Text style={styles.emptySubtitle}>No past visits logged.</Text>
                        </View>
                    )}

                </ScrollView>
            )}

            {/* Request Change Modal */}
            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Request Change</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Feather name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalDescription}>
                            Provide your preferred date, time, and reason. Requests must be made at least 48 hours before the scheduled visit.
                        </Text>

                        <Text style={styles.inputLabel}>Preferred Date</Text>
                        {Platform.OS === 'web' ? (
                            <TextInput
                                style={styles.textInput}
                                value={preferredDate}
                                onChangeText={setPreferredDate}
                                placeholder="e.g., Oct 20, 2026"
                                placeholderTextColor="#9CA3AF"
                                {...({ type: 'date' } as any)}
                            />
                        ) : (
                            <TouchableOpacity 
                                style={[styles.textInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                                onPress={() => setDatePickerVisibility(true)} 
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: preferredDate ? '#111827' : '#9CA3AF', fontSize: 15, fontFamily: 'Poppins-Regular' }}>
                                    {preferredDate || 'e.g., Oct 20, 2026'}
                                </Text>
                                <Feather name="calendar" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}

                        <Text style={styles.inputLabel}>Preferred Time</Text>
                        {Platform.OS === 'web' ? (
                            <TextInput
                                style={styles.textInput}
                                value={preferredTime}
                                onChangeText={setPreferredTime}
                                placeholder="e.g., 10:00 AM"
                                placeholderTextColor="#9CA3AF"
                                {...({ type: 'time' } as any)}
                            />
                        ) : (
                            <TouchableOpacity 
                                style={[styles.textInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                                onPress={() => setTimePickerVisibility(true)} 
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: preferredTime ? '#111827' : '#9CA3AF', fontSize: 15, fontFamily: 'Poppins-Regular' }}>
                                    {preferredTime || 'e.g., 10:00 AM'}
                                </Text>
                                <Feather name="clock" size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}

                        <Text style={styles.inputLabel}>Reason for Change</Text>
                        <TextInput
                            style={[styles.textInput, styles.textArea]}
                            placeholder="Why do you need to change this visit?"
                            placeholderTextColor="#9CA3AF"
                            multiline
                            numberOfLines={4}
                            value={changeReason}
                            onChangeText={setChangeReason}
                        />

                        <TouchableOpacity 
                            style={[styles.submitModalButton, submittingChange && { opacity: 0.7 }]}
                            onPress={submitChangeRequest}
                            disabled={submittingChange}
                        >
                            {submittingChange ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.submitModalText}>Submit Request</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
                <DateTimePickerModal
                    isVisible={isDatePickerVisible}
                    mode="date"
                    onConfirm={handleConfirmDate}
                    onCancel={() => setDatePickerVisibility(false)}
                />
                <DateTimePickerModal
                    isVisible={isTimePickerVisible}
                    mode="time"
                    onConfirm={handleConfirmTime}
                    onCancel={() => setTimePickerVisibility(false)}
                />
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF'
    },
    navBar: {
        height: 60,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    navBarBackBtn: {
        position: 'absolute',
        left: 20,
        zIndex: 1,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    navBarTitle: {
        fontSize: 18,
        color: '#111827',
        fontFamily: 'Poppins-Medium',
    },
    content: {
        backgroundColor: '#FFF0E6',
        flexGrow: 1,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    },
    sectionHeader: {
        fontSize: 18,
        color: '#111827',
        fontFamily: 'Poppins-Medium',
        marginBottom: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    badgeUpcoming: {
        alignSelf: 'flex-start',
        backgroundColor: '#E6F7EB',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginBottom: 16,
    },
    badgeUpcomingText: {
        fontSize: 13,
        color: '#10B981',
        fontFamily: 'Poppins-Medium',
    },
    badgeCompleted: {
        alignSelf: 'flex-start',
        backgroundColor: '#F3F4F6',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginBottom: 16,
    },
    badgeCompletedText: {
        fontSize: 13,
        color: '#4B5563',
        fontFamily: 'Poppins-Medium',
    },
    visitTitle: {
        fontSize: 17,
        color: '#111827',
        fontFamily: 'Poppins-Medium',
        marginBottom: 12,
    },
    detailsContainer: {
        gap: 8,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailIcon: {
        width: 20,
        marginRight: 8,
    },
    detailText: {
        fontSize: 14,
        color: '#4B5563',
        fontFamily: 'Poppins-Regular',
    },
    requestButton: {
        borderWidth: 1,
        borderColor: '#FE6700',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 20,
    },
    requestButtonText: {
        color: '#FE6700',
        fontSize: 15,
        fontFamily: 'Poppins-Medium',
    },
    requestButtonDisabled: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginTop: 20,
    },
    requestButtonTextDisabled: {
        color: '#9CA3AF',
        fontSize: 15,
        fontFamily: 'Poppins-Medium',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#FFF0E6',
    },
    loaderText: {
        fontSize: 15,
        color: '#6B7280',
        fontFamily: 'Poppins-Medium',
        marginTop: 12,
    },
    errorIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    errorTitle: {
        fontSize: 18,
        color: '#111827',
        fontFamily: 'Poppins-SemiBold',
        marginBottom: 6,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        lineHeight: 20,
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    retryButton: {
        backgroundColor: '#FE6700',
        paddingHorizontal: 24,
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 2,
    },
    retryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Poppins-Medium',
    },
    // Guest Encouragement Styles
    guestContent: {
        flexGrow: 1,
        backgroundColor: '#FFF0E6',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
        justifyContent: 'center',
    },
    guestCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 16,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    guestBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FFEDD5',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
        marginBottom: 16,
    },
    guestBadgeText: {
        fontSize: 12,
        fontFamily: 'Poppins-Medium',
        color: '#FE6700',
    },
    guestIconWrap: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FFEDD5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    guestTitle: {
        fontSize: 20,
        fontFamily: 'Poppins-SemiBold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    guestDesc: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    guestFeatureList: {
        width: '100%',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        gap: 12,
        marginBottom: 24,
    },
    guestFeatureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    guestFeatureText: {
        fontSize: 13,
        fontFamily: 'Poppins-Regular',
        color: '#374151',
        flex: 1,
        lineHeight: 18,
    },
    guestPrimaryBtn: {
        width: '100%',
        backgroundColor: '#FE6700',
        borderRadius: 14,
        height: 52,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    guestPrimaryBtnText: {
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
        color: '#FFFFFF',
    },
    guestSecondaryBtn: {
        marginTop: 14,
        paddingVertical: 8,
        alignItems: 'center',
    },
    guestSecondaryBtnText: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#6B7280',
    },
    guestSecondaryLink: {
        fontFamily: 'Poppins-SemiBold',
        color: '#FE6700',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        paddingHorizontal: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        marginTop: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        color: '#111827',
        fontFamily: 'Poppins-SemiBold',
    },
    modalDescription: {
        fontSize: 14,
        color: '#6B7280',
        fontFamily: 'Poppins-Regular',
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 13,
        color: '#374151',
        fontFamily: 'Poppins-Medium',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: '#111827',
        fontFamily: 'Poppins-Regular',
        marginBottom: 16,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    submitModalButton: {
        backgroundColor: '#FE6700',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    submitModalText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Poppins-SemiBold',
    },
    rejectionAlert: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    rejectionTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 13,
        color: '#DC2626',
        marginBottom: 2,
    },
    rejectionReason: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#991B1B',
        fontStyle: 'italic',
    },
    acceptedAlert: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        flexDirection: 'row',
        alignItems: 'center',
    },
    acceptedText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 13,
        color: '#059669',
    }
});