import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccessRequestsModal } from './AccessRequestsModal';
import { RequestAccessModal } from './RequestAccessModal';

interface AccessRequestsBannerProps {
    pendingCount: number;
    onChanged?: () => void;
}

/**
 * Self-contained dashboard notification banner when incoming Access Requests or Invites exist.
 * Encapsulates AccessRequestsModal state so parent screens stay clean.
 */
export const AccessRequestsBanner: React.FC<AccessRequestsBannerProps> = ({
    pendingCount,
    onChanged,
}) => {
    const [open, setOpen] = useState(false);

    if (!pendingCount || pendingCount <= 0) return null;

    return (
        <>
            <TouchableOpacity
                style={styles.banner}
                onPress={() => setOpen(true)}
                activeOpacity={0.85}
            >
                <View style={styles.bannerIcon}>
                    <Ionicons name="notifications" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.bannerTextWrap}>
                    <Text style={styles.bannerTitle}>
                        {pendingCount === 1
                            ? '1 Pending Access Request'
                            : `${pendingCount} Pending Access Requests`}
                    </Text>
                    <Text style={styles.bannerSub}>
                        Tap to review and approve or decline family access
                    </Text>
                </View>
                <View style={styles.reviewPill}>
                    <Text style={styles.reviewPillText}>Review</Text>
                </View>
            </TouchableOpacity>

            <AccessRequestsModal
                visible={open}
                onClose={() => setOpen(false)}
                onChanged={onChanged}
                initialTab="incoming"
            />
        </>
    );
};

interface ProfileAccessActionButtonsProps {
    pendingCount?: number;
    onChanged?: () => void;
}

/**
 * Self-contained action bar providing "Ask for Access" and "Requests" buttons.
 * Works for all 8 user types — including Free Users who haven't subscribed yet.
 */
export const ProfileAccessActionButtons: React.FC<ProfileAccessActionButtonsProps> = ({
    pendingCount = 0,
    onChanged,
}) => {
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showInboxModal, setShowInboxModal] = useState(false);

    return (
        <>
            <View style={styles.barRow}>
                <TouchableOpacity
                    style={styles.askBtn}
                    onPress={() => setShowRequestModal(true)}
                    activeOpacity={0.85}
                >
                    <Ionicons name="hand-left-outline" size={15} color="#059669" style={{ marginRight: 6 }} />
                    <Text style={styles.askBtnText}>Ask for Access</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.inboxBtn}
                    onPress={() => setShowInboxModal(true)}
                    activeOpacity={0.85}
                >
                    <Ionicons name="mail-unread-outline" size={15} color="#4B5563" style={{ marginRight: 6 }} />
                    <Text style={styles.inboxBtnText}>Requests</Text>
                    {pendingCount > 0 && (
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{pendingCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <RequestAccessModal
                visible={showRequestModal}
                onClose={() => setShowRequestModal(false)}
                onSuccess={onChanged}
            />

            <AccessRequestsModal
                visible={showInboxModal}
                onClose={() => setShowInboxModal(false)}
                onChanged={onChanged}
                initialTab={pendingCount > 0 ? 'incoming' : 'outgoing'}
            />
        </>
    );
};

const styles = StyleSheet.create({
    banner: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF7ED',
        borderWidth: 1.5,
        borderColor: '#FDBA74',
        borderRadius: 16,
        padding: 12,
        marginBottom: 14,
        gap: 10,
    },
    bannerIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#FE6700',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerTextWrap: {
        flex: 1,
    },
    bannerTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#9A3412',
    },
    bannerSub: {
        fontSize: 11,
        color: '#C2410C',
        marginTop: 2,
    },
    reviewPill: {
        backgroundColor: '#FE6700',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    reviewPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    barRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
        width: '100%',
    },
    askBtn: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        backgroundColor: '#ECFDF5',
    },
    askBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#047857',
    },
    inboxBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    inboxBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
    },
    countBadge: {
        marginLeft: 6,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#FE6700',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    countBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});
