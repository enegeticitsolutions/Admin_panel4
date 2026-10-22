import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather, AntDesign, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { ConnectContactButton } from '@/components/shared/ConnectContactModal';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';

export interface PersonalCareData {
    beneficiaryId?: string;
    beneficiaryName?: string;
    greeting?: string;
    firstName?: string;
    nextVisit?: string | null;
    adherence?: string;
    careCoordinator?: {
        id: string;
        name: string;
        role: string;
        bio: string;
        photo: string | null;
        phone?: string | null;
    } | null;
    todaysMedications?: Array<{
        id: string;
        name: string;
        dosage: string;
        condition: string;
        time: string;
        completed: boolean;
        adherenceScore: number;
    }>;
}

interface PersonalCareOverviewProps {
    data: PersonalCareData;
    onViewTeam: () => void;
    onViewAllMeds: () => void;
    onOpenCareCircle?: () => void;
}

export const PersonalCareOverview: React.FC<PersonalCareOverviewProps> = ({
    data,
    onViewTeam,
    onViewAllMeds,
    onOpenCareCircle,
}) => {
    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Not Scheduled';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <View style={styles.container}>
            {/* ── Care Circle Share Banner for My Profile ── */}
            {onOpenCareCircle && (
                <View style={styles.careCircleBanner}>
                    <View style={styles.careCircleLeft}>
                        <View style={styles.careCircleIconCircle}>
                            <Ionicons name="people" size={18} color="#FE6700" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.careCircleHeading}>My Care Circle</Text>
                            <Text style={styles.careCircleSubheading}>
                                Share your care updates with family (Son, Brother, Spouse)
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.careCircleShareBtn}
                        onPress={onOpenCareCircle}
                        activeOpacity={0.8}
                    >
                        <Feather name="user-plus" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.careCircleShareBtnText}>Share Access</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Personal Stats Row ── */}
            {(data.nextVisit || data.adherence) && (
                <View style={styles.statsRow}>
                    {data.nextVisit && (
                        <View style={styles.statCard}>
                            <View style={[styles.statIconBadge, { backgroundColor: '#DBEAFE' }]}>
                                <Feather name="calendar" size={20} color="#155DFC" />
                            </View>
                            <Text style={styles.statLabel}>Next Visit</Text>
                            <Text style={styles.statValue}>{formatDate(data.nextVisit)}</Text>
                        </View>
                    )}

                    {data.adherence && (
                        <View style={styles.statCard}>
                            <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                                <Feather name="trending-up" size={20} color="#00A63E" />
                            </View>
                            <Text style={styles.statLabel}>Adherence</Text>
                            <Text style={styles.statValue}>{data.adherence}</Text>
                        </View>
                    )}
                </View>
            )}

            {/* ── Care Coordinator ── */}
            {data.careCoordinator && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Your Care Coordinator</Text>
                        <TouchableOpacity onPress={onViewTeam} activeOpacity={0.7}>
                            <Text style={styles.linkText}>View Team</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.ccCard}>
                        <View style={styles.ccHeader}>
                            <View style={styles.ccAvatar}>
                                {data.careCoordinator.photo ? (
                                    <Image
                                        source={{ uri: sanitizeImageUri(data.careCoordinator.photo) }}
                                        style={styles.ccImage}
                                    />
                                ) : (
                                    <AntDesign name="user" size={30} color="#AAAAAA" />
                                )}
                            </View>

                            <View style={styles.ccInfo}>
                                <Text style={styles.ccName}>{data.careCoordinator.name}</Text>
                                <Text style={styles.ccRole}>{data.careCoordinator.role}</Text>
                            </View>
                        </View>

                        <Text style={styles.ccBio} numberOfLines={2}>
                            {data.careCoordinator.bio}
                        </Text>

                        <ConnectContactButton
                            name={data.careCoordinator.name}
                            role={data.careCoordinator.role}
                            phone={data.careCoordinator.phone || null}
                            photo={data.careCoordinator.photo}
                            trigger={
                                <View style={styles.primaryBtn}>
                                    <Text style={styles.primaryBtnText}>Call Now</Text>
                                </View>
                            }
                        />
                    </View>
                </>
            )}

            {/* ── Today's Medications ── */}
            {data.todaysMedications && data.todaysMedications.length > 0 && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today's Medications</Text>
                        <TouchableOpacity onPress={onViewAllMeds} activeOpacity={0.7}>
                            <Text style={styles.linkText}>View All</Text>
                        </TouchableOpacity>
                    </View>

                    {data.todaysMedications.map((med) => (
                        <View key={med.id} style={styles.medCard}>
                            <View style={styles.medHeader}>
                                <View style={styles.medIconBadge}>
                                    <MaterialCommunityIcons name="pill" size={20} color="#FE6700" />
                                </View>
                                <View style={styles.medInfo}>
                                    <Text style={styles.medName}>{med.name}</Text>
                                    <Text style={styles.medDosage}>
                                        {med.dosage} • {med.condition}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.medFooter}>
                                <Text style={styles.medTime}>⏰ {med.time}</Text>
                                <View style={styles.adherenceBadge}>
                                    <Text style={styles.adherenceBadgeText}>
                                        Adherence {med.adherenceScore}%
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
    careCircleBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF8F3',
        borderWidth: 1,
        borderColor: '#FED7AA',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
    },
    careCircleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    careCircleIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFEDD5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    careCircleHeading: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 13,
        color: '#111827',
    },
    careCircleSubheading: {
        fontFamily: 'Poppins-Regular',
        fontSize: 11,
        color: '#6B7280',
        marginTop: 1,
    },
    careCircleShareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FE6700',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    careCircleShareBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12,
        color: '#FFFFFF',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    statIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statLabel: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        lineHeight: 16,
        color: '#64748B',
    },
    statValue: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        lineHeight: 24,
        color: '#0F172A',
        marginTop: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        marginTop: 8,
    },
    sectionTitle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
        lineHeight: 24,
        color: '#0F172A',
    },
    linkText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
        lineHeight: 20,
        color: '#FF6A00',
    },
    ccCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    ccHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    ccAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    ccImage: {
        width: 48,
        height: 48,
    },
    ccInfo: {
        marginLeft: 12,
        flex: 1,
    },
    ccName: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        lineHeight: 22,
        color: '#0F172A',
    },
    ccRole: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        lineHeight: 16,
        color: '#64748B',
    },
    ccBio: {
        fontFamily: 'Poppins-Regular',
        fontSize: 13,
        lineHeight: 18,
        color: '#334155',
        marginBottom: 14,
    },
    primaryBtn: {
        backgroundColor: '#FF6A00',
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
    },
    primaryBtnText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
        color: '#FFFFFF',
    },
    medCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    medHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    medIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#FFF7ED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    medInfo: {
        marginLeft: 12,
        flex: 1,
    },
    medName: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 15,
        color: '#0F172A',
    },
    medDosage: {
        fontFamily: 'Poppins-Regular',
        fontSize: 12,
        color: '#64748B',
    },
    medFooter: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    medTime: {
        fontFamily: 'Poppins-Medium',
        fontSize: 13,
        color: '#334155',
    },
    adherenceBadge: {
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    adherenceBadgeText: {
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
        color: '#16A34A',
    },
});
