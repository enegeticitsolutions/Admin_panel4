import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

interface FamilyConnectIntroModalProps {
    visible: boolean;
    onClose: () => void;
    onExplorePackages: () => void;
    onAddFamilyMember: () => void;
    onJoinWithCode: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const FamilyConnectIntroModal: React.FC<FamilyConnectIntroModalProps> = ({
    visible,
    onClose,
    onExplorePackages,
    onAddFamilyMember,
    onJoinWithCode,
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.sheetContainer}>
                    {/* Header Bar */}
                    <View style={styles.header}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="people" size={26} color="#FE6700" />
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                            <Ionicons name="close" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        <Text style={styles.title}>What is Family Connect?</Text>
                        <Text style={styles.subtitle}>
                            MaiHoonNa Family Connect keeps your entire family connected to your parents&apos; daily care, visits, and health progress.
                        </Text>

                        {/* Feature Highlights */}
                        <View style={styles.featuresList}>
                            <View style={styles.featureItem}>
                                <View style={[styles.featureIconWrap, { backgroundColor: '#EFF6FF' }]}>
                                    <MaterialCommunityIcons name="home-heart" size={22} color="#2563EB" />
                                </View>
                                <View style={styles.featureTextWrap}>
                                    <Text style={styles.featureTitle}>Compassionate Home Visits</Text>
                                    <Text style={styles.featureDesc}>
                                        Trained, verified Care Companions visit your elders for social engagement, walks, and assistance.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={[styles.featureIconWrap, { backgroundColor: '#ECFDF5' }]}>
                                    <Feather name="activity" size={22} color="#059669" />
                                </View>
                                <View style={styles.featureTextWrap}>
                                    <Text style={styles.featureTitle}>Real-time Health & Vitals</Text>
                                    <Text style={styles.featureDesc}>
                                        Track blood pressure, sugar levels, and medications with live doctor & companion logs.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={[styles.featureIconWrap, { backgroundColor: '#FFF7ED' }]}>
                                    <Ionicons name="newspaper-outline" size={22} color="#EA580C" />
                                </View>
                                <View style={styles.featureTextWrap}>
                                    <Text style={styles.featureTitle}>Live Visit Photos & Updates</Text>
                                    <Text style={styles.featureDesc}>
                                        Receive emotional check-ins, mood scores, and photos directly in your app after every visit.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={[styles.featureIconWrap, { backgroundColor: '#FDF2F8' }]}>
                                    <Ionicons name="share-social-outline" size={22} color="#DB2777" />
                                </View>
                                <View style={styles.featureTextWrap}>
                                    <Text style={styles.featureTitle}>Shared Family Circle</Text>
                                    <Text style={styles.featureDesc}>
                                        Invite siblings or spouse so everyone can monitor, renew care plans, and stay informed together.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={[styles.featureIconWrap, { backgroundColor: '#FEF2F2' }]}>
                                    <Feather name="shield" size={22} color="#DC2626" />
                                </View>
                                <View style={styles.featureTextWrap}>
                                    <Text style={styles.featureTitle}>24/7 SOS Emergency Support</Text>
                                    <Text style={styles.featureDesc}>
                                        Instant emergency alerts sent to all family members with dedicated on-ground response.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Bottom Action Buttons */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => {
                                onClose();
                                onExplorePackages();
                            }}
                            activeOpacity={0.85}
                        >
                            <Feather name="shopping-bag" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.primaryBtnText}>Explore Care Packages</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={() => {
                                onClose();
                                onAddFamilyMember();
                            }}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="person-add-outline" size={18} color="#FE6700" style={{ marginRight: 8 }} />
                            <Text style={styles.secondaryBtnText}>Add a Family Member</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.inviteCodeBtn}
                            onPress={() => {
                                onClose();
                                onJoinWithCode();
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.inviteCodeText}>
                                Have an invite code from family? <Text style={styles.inviteCodeHighlight}>Join Care Circle</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: SCREEN_HEIGHT * 0.88,
        paddingTop: 16,
        paddingBottom: 28,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFF5ED',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 20,
        marginBottom: 20,
    },
    featuresList: {
        gap: 16,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    featureIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        marginTop: 2,
    },
    featureTextWrap: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    featureDesc: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
    },
    footer: {
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        gap: 10,
    },
    primaryBtn: {
        backgroundColor: '#FE6700',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryBtn: {
        backgroundColor: '#FFF5ED',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFD9C0',
    },
    secondaryBtnText: {
        color: '#FE6700',
        fontSize: 14,
        fontWeight: '700',
    },
    inviteCodeBtn: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    inviteCodeText: {
        fontSize: 13,
        color: '#6B7280',
    },
    inviteCodeHighlight: {
        color: '#2563EB',
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
});
