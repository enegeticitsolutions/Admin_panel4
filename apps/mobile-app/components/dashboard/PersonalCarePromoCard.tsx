import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface PersonalCarePromoCardProps {
    isCompact?: boolean;
    isGuest?: boolean;
    onExplorePress: () => void;
}

export const PersonalCarePromoCard: React.FC<PersonalCarePromoCardProps> = ({
    isCompact = false,
    isGuest = false,
    onExplorePress,
}) => {
    if (isCompact) {
        return (
            <View style={styles.compactCard}>
                <View style={styles.compactTop}>
                    <View style={styles.compactIconBox}>
                        <Feather name="shield" size={20} color="#FE6700" />
                    </View>
                    <View style={styles.compactTextWrap}>
                        <Text style={styles.compactTitle}>
                            {isGuest ? 'Dedicated Elder Care Plans' : 'Care for yourself too'}
                        </Text>
                        <Text style={styles.compactSub}>
                            {isGuest
                                ? 'Protect health and wellness with dedicated Saathi companion visits, vitals checks, and 24/7 care support.'
                                : 'You manage care and payments for your family. Protect your own wellness with dedicated companion visits & health checks.'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.compactBtn}
                    onPress={onExplorePress}
                    activeOpacity={0.85}
                >
                    <Text style={styles.compactBtnText}>
                        {isGuest ? 'Explore Care Plans' : 'Explore Plans for Myself'}
                    </Text>
                    <Feather name="arrow-right" size={15} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.fullCard}>
            <View style={styles.fullHeader}>
                <View style={styles.fullIconBox}>
                    <Feather name="shield" size={24} color="#FE6700" />
                </View>
                <View style={styles.fullHeaderTextWrap}>
                    <Text style={styles.fullTitle}>
                        {isGuest ? 'Dedicated Care Plans' : 'Personal Care Plan'}
                    </Text>
                    <Text style={styles.fullSubtitle}>
                        {isGuest ? 'Verified companions & health monitoring' : 'No active plan for yourself yet'}
                    </Text>
                </View>
            </View>
            <Text style={styles.fullDesc}>
                {isGuest
                    ? 'Protect your loved ones or your own wellness with dedicated Saathi companion visits, regular vitals checkups, and 24/7 emergency care support.'
                    : 'You are managing care and payments for your family. Protect your own wellness with dedicated companion visits, regular vitals checkups, and 24/7 care support.'}
            </Text>
            <TouchableOpacity
                style={styles.fullBtn}
                onPress={onExplorePress}
                activeOpacity={0.85}
            >
                <Text style={styles.fullBtnText}>
                    {isGuest ? 'Explore Care Plans' : 'Explore Plans for Myself'}
                </Text>
                <Feather name="arrow-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    compactCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FFE4D6',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    compactTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    compactIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#FFF5ED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactTextWrap: {
        flex: 1,
        marginLeft: 12,
    },
    compactTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 15,
        color: '#111827',
    },
    compactSub: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#4B5563',
        lineHeight: 17,
        marginTop: 2,
    },
    compactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FE6700',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 6,
    },
    compactBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
        color: '#FFFFFF',
    },
    fullCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FFE4D6',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    fullHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    fullIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#FFF5ED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullHeaderTextWrap: {
        flex: 1,
        marginLeft: 12,
    },
    fullTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        color: '#111827',
    },
    fullSubtitle: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#6B7280',
    },
    fullDesc: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        color: '#4B5563',
        lineHeight: 19,
        marginBottom: 14,
    },
    fullBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FE6700',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 8,
    },
    fullBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        color: '#FFFFFF',
    },
});
