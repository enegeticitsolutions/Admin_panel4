import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { addNotificationReceivedListener } from '@/services/notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeBack } from '@/hooks/useSafeBack';
import { scale, vscale } from '@/utils/responsive';
import { useGlobalRefresh, emitGlobalRefresh } from '@/utils/events';

// Custom SVG Icons matching design
const CustomMailOpenIcon = ({ size = 22, color = '#9CA3AF' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z" />
        <Path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10" />
    </Svg>
);

const CustomMailClosedIcon = ({ size = 22, color = '#FE6700' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <Rect width="20" height="16" x="2" y="4" rx="2" />
        <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </Svg>
);

export interface NotificationMessage {
    id: string;
    sender: string;
    date: string;
    subject: string;
    body: string;
    isRead: boolean;
    type: 'general' | 'visit' | 'medication' | 'celebration' | 'emergency';
    rawDate?: Date;
}

const FALLBACK_MESSAGES: NotificationMessage[] = [
    {
        id: 'fallback-1',
        sender: 'Dr. Sarah Johnson',
        date: 'Feb 20, 10:30 AM',
        subject: 'Upcoming Home Visit Scheduled',
        body: 'Your upcoming home health visit has been confirmed for Feb 26th. Your Care Companion will arrive between 10:00 AM and 11:30 AM.',
        isRead: false,
        type: 'visit',
    },
    {
        id: 'fallback-2',
        sender: 'Care Operations',
        date: 'Feb 18, 04:15 PM',
        subject: 'Schedule Request Update',
        body: 'We have received your schedule change request. Our coordination team has approved the updated visit slot.',
        isRead: true,
        type: 'general',
    },
    {
        id: 'fallback-3',
        sender: 'Medication Tracker',
        date: 'Feb 15, 08:00 AM',
        subject: 'Daily Medication Reminder',
        body: 'Please remember to take your morning dosage of Metformin (500mg) and Lisinopril (10mg) with water.',
        isRead: true,
        type: 'medication',
    },
];

interface InboxViewProps {
    showBackButton?: boolean;
    accentColor?: string;
}

export function InboxView({ showBackButton = false, accentColor = '#FE6700' }: InboxViewProps) {
    const safeBack = useSafeBack();

    const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'visits' | 'meds'>('all');
    const [selectedMessage, setSelectedMessage] = useState<NotificationMessage | null>(null);

    const fetchNotifications = async () => {
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                setNotifications(FALLBACK_MESSAGES);
                return;
            }

            const res = await fetch(`${API_URL}/shared/users/notifications`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                const formatted: NotificationMessage[] = data.data.map((item: any) => {
                    const rawDate = item.sentAt ? new Date(item.sentAt) : item.createdAt ? new Date(item.createdAt) : new Date();
                    const formattedDate = rawDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    });

                    let type: NotificationMessage['type'] = 'general';
                    const lowerType = (item.type || '').toLowerCase();
                    if (lowerType.includes('visit')) type = 'visit';
                    else if (lowerType.includes('med')) type = 'medication';
                    else if (lowerType.includes('celeb')) type = 'celebration';
                    else if (lowerType.includes('emerg')) type = 'emergency';

                    return {
                        id: String(item.id),
                        sender: item.title || 'MaiHoonNa Care',
                        subject: item.title || 'Notification',
                        body: item.body || '',
                        date: formattedDate,
                        isRead: !!item.isRead,
                        type,
                        rawDate,
                    };
                });
                setNotifications(formatted);
            } else {
                setNotifications(FALLBACK_MESSAGES);
            }
        } catch (err) {
            console.error('Error fetching inbox notifications:', err);
            setNotifications(FALLBACK_MESSAGES);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [])
    );

    useGlobalRefresh(() => { fetchNotifications(); });

    useEffect(() => {
        const sub = addNotificationReceivedListener(() => {
            fetchNotifications();
        });
        return () => sub.remove();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const handleSelectMessage = async (msg: NotificationMessage) => {
        setSelectedMessage(msg);
        if (!msg.isRead) {
            setNotifications(prev =>
                prev.map(n => (n.id === msg.id ? { ...n, isRead: true } : n))
            );

            try {
                const token = await AsyncStorage.getItem('userToken');
                if (token && !msg.id.startsWith('fallback-')) {
                    await fetch(`${API_URL}/shared/users/notifications/${msg.id}/read`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    emitGlobalRefresh();
                }
            } catch (e) {
                console.error('Error marking notification as read:', e);
            }
        }
    };

    const handleMarkAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        try {
            const token = await AsyncStorage.getItem('userToken');
            if (token) {
                await fetch(`${API_URL}/shared/users/notifications/read-all`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` },
                });
                emitGlobalRefresh();
            }
        } catch (e) {
            console.error('Error marking all as read:', e);
        }
    };

    const filteredNotifications = notifications.filter(item => {
        if (activeFilter === 'unread') return !item.isRead;
        if (activeFilter === 'visits') return item.type === 'visit';
        if (activeFilter === 'meds') return item.type === 'medication';
        return true;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {showBackButton && (
                        <TouchableOpacity
                            onPress={() => safeBack()}
                            style={styles.backBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Feather name="arrow-left" size={22} color="#111827" />
                        </TouchableOpacity>
                    )}
                    <Text style={styles.headerTitle}>Inbox</Text>
                    {unreadCount > 0 && (
                        <View style={[styles.headerUnreadBadge, { backgroundColor: accentColor }]}>
                            <Text style={styles.headerUnreadBadgeText}>{unreadCount}</Text>
                        </View>
                    )}
                </View>

                {unreadCount > 0 && (
                    <TouchableOpacity onPress={handleMarkAllRead} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={[styles.markAllReadText, { color: accentColor }]}>Mark all as read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Category Filter Pills */}
            <View style={styles.filterBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    <TouchableOpacity
                        style={[styles.filterPill, activeFilter === 'all' && { backgroundColor: accentColor, borderColor: accentColor }]}
                        onPress={() => setActiveFilter('all')}
                    >
                        <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive]}>
                            All ({notifications.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterPill, activeFilter === 'unread' && { backgroundColor: accentColor, borderColor: accentColor }]}
                        onPress={() => setActiveFilter('unread')}
                    >
                        <Text style={[styles.filterPillText, activeFilter === 'unread' && styles.filterPillTextActive]}>
                            Unread ({unreadCount})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterPill, activeFilter === 'visits' && { backgroundColor: accentColor, borderColor: accentColor }]}
                        onPress={() => setActiveFilter('visits')}
                    >
                        <Text style={[styles.filterPillText, activeFilter === 'visits' && styles.filterPillTextActive]}>
                            Visits
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterPill, activeFilter === 'meds' && { backgroundColor: accentColor, borderColor: accentColor }]}
                        onPress={() => setActiveFilter('meds')}
                    >
                        <Text style={[styles.filterPillText, activeFilter === 'meds' && styles.filterPillTextActive]}>
                            Medications
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={accentColor} />
                    <Text style={styles.loadingText}>Loading inbox messages...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[accentColor]} tintColor={accentColor} />
                    }
                >
                    {filteredNotifications.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconWrap}>
                                <Ionicons name="mail-open-outline" size={48} color="#9CA3AF" />
                            </View>
                            <Text style={styles.emptyTitle}>No Messages Found</Text>
                            <Text style={styles.emptySub}>
                                {activeFilter === 'unread'
                                    ? 'You have read all messages in your inbox!'
                                    : 'There are no notifications in this category.'}
                            </Text>
                        </View>
                    ) : (
                        filteredNotifications.map(message => (
                            <TouchableOpacity
                                key={message.id}
                                style={[styles.messageCard, !message.isRead && [styles.unreadMessageCard, { borderLeftColor: accentColor }]]}
                                activeOpacity={0.7}
                                onPress={() => handleSelectMessage(message)}
                            >
                                <View style={styles.messageIcon}>
                                    {!message.isRead ? <CustomMailClosedIcon color={accentColor} /> : <CustomMailOpenIcon />}
                                </View>

                                <View style={styles.messageBody}>
                                    <View style={styles.messageTopRow}>
                                        <Text style={[styles.sender, !message.isRead && styles.unreadSender]} numberOfLines={1}>
                                             {message.sender}
                                        </Text>
                                        <Text style={styles.date}>{message.date}</Text>
                                    </View>

                                    <Text style={[styles.subject, !message.isRead && styles.unreadSubject]} numberOfLines={1}>
                                        {message.subject}
                                    </Text>

                                    <Text style={styles.preview} numberOfLines={2}>
                                        {message.body}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* MESSAGE POPUP MODAL */}
            <Modal visible={selectedMessage !== null} animationType="fade" transparent={true}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalSubject} numberOfLines={2}>
                                {selectedMessage?.subject}
                            </Text>
                            <TouchableOpacity onPress={() => setSelectedMessage(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Feather name="x" size={24} color="#4B5563" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalMetaRow}>
                            <View style={styles.modalSenderBlock}>
                                <View style={styles.modalAvatarPlaceholder}>
                                    <Text style={[styles.modalAvatarText, { color: accentColor }]}>
                                        {selectedMessage?.sender.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={styles.modalSender}>{selectedMessage?.sender}</Text>
                            </View>
                            <Text style={styles.modalDate}>{selectedMessage?.date}</Text>
                        </View>

                        <View style={styles.modalDivider} />

                        <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalBodyText}>{selectedMessage?.body}</Text>
                        </ScrollView>

                        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: accentColor }]} onPress={() => setSelectedMessage(null)} activeOpacity={0.8}>
                            <Text style={styles.closeBtnText}>Close Message</Text>
                        </TouchableOpacity>
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
        width: '100%',
        height: scale(56),
        backgroundColor: '#FFF0E6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(16),
        borderBottomWidth: 1,
        borderBottomColor: '#FEE2E2',
    },
    backBtn: {
        marginRight: scale(10),
    },
    headerTitle: {
        fontSize: scale(18),
        color: '#111827',
        fontFamily: 'Poppins-Bold',
    },
    headerUnreadBadge: {
        borderRadius: scale(12),
        paddingHorizontal: scale(8),
        paddingVertical: scale(2),
        marginLeft: scale(8),
    },
    headerUnreadBadgeText: {
        fontFamily: 'Poppins-Bold',
        fontSize: scale(11),
        color: '#FFFFFF',
    },
    markAllReadText: {
        fontFamily: 'Poppins-Medium',
        fontSize: scale(13),
    },

    filterBar: {
        width: '100%',
        backgroundColor: '#FFF0E6',
        paddingVertical: scale(10),
    },
    filterScroll: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(16),
    },
    filterPill: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(20),
        paddingHorizontal: scale(14),
        paddingVertical: scale(6),
        marginRight: scale(8),
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterPillText: {
        fontFamily: 'Poppins-Medium',
        fontSize: scale(12),
        color: '#4B5563',
    },
    filterPillTextActive: {
        color: '#FFFFFF',
    },

    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: scale(10),
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        color: '#6B7280',
    },

    scroll: {
        flex: 1,
        backgroundColor: '#FFF0E6',
    },
    content: {
        width: '100%',
        maxWidth: 680,
        alignSelf: 'center',
        paddingHorizontal: scale(16),
        paddingTop: scale(8),
        paddingBottom: scale(32),
    },
    messageCard: {
        width: '100%',
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: scale(16),
        padding: scale(16),
        marginBottom: scale(12),
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    unreadMessageCard: {
        borderLeftWidth: 4,
        backgroundColor: '#FFFFFF',
    },
    messageIcon: {
        marginRight: scale(12),
        justifyContent: 'flex-start',
        paddingTop: scale(2),
    },
    messageBody: {
        flex: 1,
    },
    messageTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(4),
    },
    sender: {
        fontFamily: 'Poppins-Medium',
        fontSize: scale(14),
        color: '#4B5563',
        flex: 1,
        marginRight: scale(8),
    },
    unreadSender: {
        fontFamily: 'Poppins-SemiBold',
        color: '#111827',
    },
    date: {
        fontFamily: 'Poppins-Regular',
        fontSize: scale(12),
        color: '#9CA3AF',
    },
    subject: {
        fontFamily: 'Poppins-Medium',
        fontSize: scale(15),
        color: '#374151',
        marginBottom: scale(4),
    },
    unreadSubject: {
        fontFamily: 'Poppins-Bold',
        color: '#111827',
    },
    preview: {
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
        color: '#6B7280',
        lineHeight: scale(18),
    },

    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: scale(60),
    },
    emptyIconWrap: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(16),
    },
    emptyTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: scale(18),
        color: '#111827',
        marginBottom: scale(6),
    },
    emptySub: {
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        color: '#6B7280',
        textAlign: 'center',
        paddingHorizontal: scale(30),
    },

    // Modal Styles
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(16),
    },
    modalCard: {
        width: '100%',
        maxWidth: scale(480),
        backgroundColor: '#FFFFFF',
        borderRadius: scale(20),
        padding: scale(20),
        maxHeight: '80%',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: scale(14),
    },
    modalSubject: {
        fontFamily: 'Poppins-Bold',
        fontSize: scale(17),
        color: '#111827',
        flex: 1,
        marginRight: scale(10),
    },
    modalMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(12),
    },
    modalSenderBlock: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalAvatarPlaceholder: {
        width: scale(32),
        height: scale(32),
        borderRadius: scale(16),
        backgroundColor: '#FFF3EB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(10),
    },
    modalAvatarText: {
        fontFamily: 'Poppins-Bold',
        fontSize: scale(14),
    },
    modalSender: {
        fontFamily: 'Poppins-Medium',
        fontSize: scale(14),
        color: '#374151',
    },
    modalDate: {
        fontFamily: 'Poppins-Regular',
        fontSize: scale(12),
        color: '#9CA3AF',
    },
    modalDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginBottom: scale(14),
    },
    modalBodyScroll: {
        maxHeight: scale(250),
        marginBottom: scale(16),
    },
    modalBodyText: {
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        color: '#4B5563',
        lineHeight: scale(22),
    },
    closeBtn: {
        borderRadius: scale(12),
        paddingVertical: scale(12),
        alignItems: 'center',
    },
    closeBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: scale(14),
        color: '#FFFFFF',
    },
});

export default InboxView;
