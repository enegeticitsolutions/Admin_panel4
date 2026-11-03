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
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

interface SaathiIntroModalProps {
    visible: boolean;
    onClose: () => void;
    onExplorePackages: () => void;
    onRequestCallback?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SaathiIntroModal: React.FC<SaathiIntroModalProps> = ({
    visible,
    onClose,
    onExplorePackages,
    onRequestCallback,
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
                            <Feather name="users" size={26} color="#FF6A00" />
                        </View>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={onClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Feather name="x" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        <Text style={styles.title}>Meet Your Saathi Companion</Text>
                        <Text style={styles.subtitle}>
                            A compassionate, verified companion dedicated to keeping your loved ones active, safe, and socially connected when you can&apos;t be there in person.
                        </Text>

                        {/* Feature Highlights */}
                        <View style={styles.featuresList}>
                            <View style={styles.featureItem}>
                                <View style={[styles.featureIconWrap, { backgroundColor: '#EFF6FF' }]}>
                                    <FontAwesome5 name="hospital-user" size={20} color="#2563EB" />
                                </View>
                                <View style={styles.featureTextWrap}>
                                    <Text style={styles.featureTitle}>Hospital &amp; Clinic Visits</Text>
                                    <Text style={styles.featureDesc}>
                                        Doorstep pickup, clinic queue accompaniment, lab test support, and doctor instruction notes shared with you.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={[styles.featureIconWrap, { backgroundColor: '#ECFDF5' }]}>
                                    <MaterialCommunityIcons name="walk" size={24} color="#059669" />
                                </View>
                                <View style={styles.featureTextWrap}>
                                    <Text style={styles.featureTitle}>Safe Walks &amp; Errands</Text>
                                    <Text style={styles.featureDesc}>
                                        Assistance with park walks, grocery shopping, medicine pickups, and bank errands with full safety.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={[styles.featureIconWrap, { backgroundColor: '#FFF7ED' }]}>
                                    <MaterialCommunityIcons name="heart-pulse" size={22} color="#EA580C" />
                                </View>
                                <View style={styles.featureTextWrap}>
                                    <Text style={styles.featureTitle}>Conversations &amp; Mental Wellness</Text>
                                    <Text style={styles.featureDesc}>
                                        Warm, heartfelt social engagement, reading newspapers, sharing stories, and keeping loneliness away.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={[styles.featureIconWrap, { backgroundColor: '#FDF2F8' }]}>
                                    <Feather name="smartphone" size={20} color="#DB2777" />
                                </View>
                                <View style={styles.featureTextWrap}>
                                    <Text style={styles.featureTitle}>Tech Help &amp; Family Video Calls</Text>
                                    <Text style={styles.featureDesc}>
                                        Patient assistance with setting up family video calls, online ordering, and smartphone usage.
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.featureItem}>
                                <View style={[styles.featureIconWrap, { backgroundColor: '#FEF2F2' }]}>
                                    <Feather name="shield" size={20} color="#DC2626" />
                                </View>
                                <View style={styles.featureTextWrap}>
                                    <Text style={styles.featureTitle}>Police-Verified &amp; Eldercare-Trained</Text>
                                    <Text style={styles.featureDesc}>
                                        Strict background verification, biometric check, and formal geriatric care training for peace of mind.
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
                            <Text style={styles.primaryBtnText}>Explore Saathi Packages</Text>
                        </TouchableOpacity>

                        {onRequestCallback && (
                            <TouchableOpacity
                                style={styles.secondaryBtn}
                                onPress={() => {
                                    onClose();
                                    onRequestCallback();
                                }}
                                activeOpacity={0.85}
                            >
                                <Feather name="phone-call" size={18} color="#FF6A00" style={{ marginRight: 8 }} />
                                <Text style={styles.secondaryBtnText}>Talk to Care Coordinator</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: SCREEN_HEIGHT * 0.88,
        paddingTop: 16,
        paddingBottom: 28,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 20,
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
        backgroundColor: '#FFF7ED',
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
        letterSpacing: -0.4,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: '#6B7280',
        marginBottom: 20,
    },
    featuresList: {
        gap: 16,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FAFAFA',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    featureIconWrap: {
        width: 40,
        height: 40,
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
        color: '#1F2937',
        marginBottom: 4,
    },
    featureDesc: {
        fontSize: 13,
        lineHeight: 18,
        color: '#6B7280',
    },
    footer: {
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        gap: 10,
    },
    primaryBtn: {
        backgroundColor: '#FF6A00',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        shadowColor: '#FF6A00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    secondaryBtn: {
        backgroundColor: '#FFF7ED',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FFEDD5',
    },
    secondaryBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FF6A00',
    },
});

