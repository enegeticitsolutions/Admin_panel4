import React, { useState } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity, Platform,
    Modal, Animated, Pressable, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { ConnectContactButton } from '@/components/shared/ConnectContactModal';
import { PartnerServiceBadge } from '@/components/shared/PartnerServiceBadge';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { VisitDetailsModal, VisitDetailData } from './VisitDetailsModal';
import { scale } from '@/utils/responsive';

export interface VisitProps extends VisitDetailData {}

// ── Inline star-rating modal for subscriber ────────────────────────────────
const RatingModal = ({
    visible,
    companionName,
    onSubmit,
    onClose,
    submitting,
}: {
    visible: boolean;
    companionName: string;
    onSubmit: (r: number) => void;
    onClose: () => void;
    submitting: boolean;
}) => {
    const [selected, setSelected] = useState(0);

    const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={styles.modalCard} onPress={() => {}}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <Ionicons name="star" size={scale(22)} color="#F97316" />
                        <Text style={styles.modalTitle}>Rate Your Visit</Text>
                    </View>
                    <Text style={styles.modalSubtitle}>
                        How was {companionName}'s care during this visit?
                    </Text>

                    {/* Stars */}
                    <View style={styles.modalStars}>
                        {[1, 2, 3, 4, 5].map((s) => (
                            <TouchableOpacity
                                key={s}
                                onPress={() => setSelected(s)}
                                activeOpacity={0.8}
                                hitSlop={{ top: scale(8), bottom: scale(8), left: scale(6), right: scale(6) }}
                            >
                                <Ionicons
                                    name={s <= selected ? 'star' : 'star-outline'}
                                    size={scale(40)}
                                    color={s <= selected ? '#F97316' : '#D1D5DB'}
                                    style={{ marginHorizontal: scale(5) }}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Label */}
                    {selected > 0 && (
                        <Text style={styles.ratingLabel}>{labels[selected]}</Text>
                    )}

                    {/* Action Buttons */}
                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.submitBtn, !selected && styles.submitBtnDisabled]}
                            onPress={() => selected && onSubmit(selected)}
                            disabled={!selected || submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

export const TimelineTab = ({
    visits: initialVisits,
    highlightVisitId,
}: {
    visits: VisitProps[];
    highlightVisitId?: string;
}) => {
    const [visits, setVisits] = useState<VisitProps[]>(initialVisits);
    const [ratingModalVisit, setRatingModalVisit] = useState<VisitProps | null>(null);
    const [selectedDetailVisit, setSelectedDetailVisit] = useState<VisitProps | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Sync if parent updates visits
    React.useEffect(() => {
        setVisits(initialVisits);
    }, [initialVisits]);

    const handleSubmitRating = async (rating: number) => {
        if (!ratingModalVisit) return;
        const visitId = ratingModalVisit.id;

        setSubmitting(true);
        try {
            const token = await AsyncStorage.getItem('userToken');

            if (token && !visitId.startsWith('fallback')) {
                const res = await fetch(`${API_URL}/subscriber/visits/${visitId}/rate`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ rating })
                });
                const data = await res.json();
                if (!data.success) {
                    Alert.alert('Error', 'Failed to submit rating. Please try again.');
                    return;
                }
            }

            // Optimistic update
            setVisits(prev =>
                prev.map(v =>
                    v.id === visitId ? { ...v, rated: true, rating } : v
                )
            );
            setRatingModalVisit(null);
            if (selectedDetailVisit && selectedDetailVisit.id === visitId) {
                setSelectedDetailVisit(prev => prev ? { ...prev, rated: true, rating } : null);
            }
        } catch (e) {
            Alert.alert('Error', 'Network error. Please check your connection.');
        } finally {
            setSubmitting(false);
        }
    };

    if (visits.length === 0) {
        return (
            <View style={styles.emptyTab}>
                <Ionicons name="time-outline" size={scale(40)} color="#D1D5DB" />
                <Text style={styles.emptyTabText}>No visits recorded yet.</Text>
            </View>
        );
    }

    const formatDate = (rawDateStr?: string) => {
        if (!rawDateStr) return 'Recent visit';
        const datePart = rawDateStr.split('•')[0]?.trim();
        if (datePart && datePart.includes('-')) {
            const d = new Date(datePart);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }
        }
        return datePart || 'Recent visit';
    };

    const formatTimeRange = (rawDateStr?: string) => {
        if (!rawDateStr) return '';
        const timePart = rawDateStr.split('•')[1]?.trim();
        if (!timePart) return '';
        return timePart.replace(/-/g, '–');
    };

    // Keep for backward compatibility (used in 3rd party section)
    const formatDisplayDate = (rawDateStr?: string) => {
        const date = formatDate(rawDateStr);
        const time = formatTimeRange(rawDateStr);
        return time ? `${date} • ${time}` : date;
    };

    return (
        <View style={styles.container}>
            {/* Rating Modal */}
            <RatingModal
                visible={!!ratingModalVisit}
                companionName={ratingModalVisit?.companionName || 'your Care Companion'}
                onSubmit={handleSubmitRating}
                onClose={() => !submitting && setRatingModalVisit(null)}
                submitting={submitting}
            />

            {/* Visit Details Full Encounter Modal */}
            <VisitDetailsModal
                visible={!!selectedDetailVisit}
                visit={selectedDetailVisit}
                onClose={() => setSelectedDetailVisit(null)}
                onRatePress={() => {
                    if (selectedDetailVisit) {
                        setRatingModalVisit(selectedDetailVisit);
                    }
                }}
            />

            {visits.map((visit, i) => {
                const isHighlighted = !!highlightVisitId && (visit.id === highlightVisitId || visit.encounterId === highlightVisitId);
                return (
                    <TouchableOpacity
                        key={visit.id || i}
                        style={[
                            styles.visitCard,
                            visit.is3rdParty && styles.thirdPartyVisitCard,
                            isHighlighted && styles.highlightedVisitCard,
                        ]}
                        activeOpacity={0.88}
                        onPress={() => setSelectedDetailVisit(visit)}
                    >
                        {isHighlighted && (
                            <View style={styles.highlightBadge}>
                                <Ionicons name="sparkles" size={scale(12)} color="#D95800" style={{ marginRight: scale(4) }} />
                                <Text style={styles.highlightBadgeText}>Selected Update</Text>
                            </View>
                        )}
                    {/* Header: Avatar, Info, Status/Rate */}
                    {visit.is3rdParty ? (
                        <View style={styles.thirdPartyHeader}>
                            <PartnerServiceBadge
                                size={scale(50)}
                                serviceName={visit.benefitName || visit.companionName}
                                category={visit.benefitCategory || ''}
                            />

                            <View style={{ flex: 1, marginLeft: scale(12) }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: scale(2) }}>
                                    <Text style={styles.thirdPartyServiceName} numberOfLines={1}>
                                        {visit.benefitName || visit.companionName || 'External Partner Service'}
                                    </Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: scale(4) }}>
                                    <View style={styles.thirdPartyBadge}>
                                        <Ionicons name="business-outline" size={scale(10)} color="#4F46E5" />
                                        <Text style={styles.thirdPartyBadgeText}>3rd Party Service</Text>
                                    </View>
                                    <Text style={styles.partnerSubtitle}>Partner Fulfilled</Text>
                                </View>

                                <Text style={styles.visitDate}>{formatDisplayDate(visit.dateStr)}</Text>
                                <View style={styles.timingBadgeRow}>
                                    <View style={[styles.scheduledPill, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                                        <Ionicons name="time-outline" size={scale(12)} color="#7C3AED" style={{ marginRight: scale(3) }} />
                                        <Text style={[styles.scheduledPillText, { color: '#6D28D9' }]}>
                                            {visit.scheduledTimeRange || visit.scheduledStartTime || 'Scheduled'}
                                        </Text>
                                    </View>
                                    <Text style={styles.visitDuration}>{visit.scheduledDurationText || '60 mins'}</Text>
                                </View>
                                {visit.actualDurationText && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: scale(4) }}>
                                        <View style={[styles.scheduledPill, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD', marginRight: scale(6) }]}>
                                            <Ionicons name="time-outline" size={scale(12)} color="#0284C7" style={{ marginRight: scale(3) }} />
                                            <Text style={[styles.scheduledPillText, { color: '#0369A1' }]}>Actual</Text>
                                        </View>
                                        <Text style={[styles.visitDuration, { color: '#0369A1' }]}>{visit.actualDurationText}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Subscriber Rating */}
                            {visit.rated && visit.rating ? (
                                <TouchableOpacity
                                    onPress={(e) => {
                                        e.stopPropagation?.();
                                        setRatingModalVisit(visit);
                                    }}
                                    style={styles.ratedBox}
                                    hitSlop={{ top: scale(6), bottom: scale(6), left: scale(6), right: scale(6) }}
                                >
                                    <View style={styles.starsRow}>
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Ionicons
                                                key={s}
                                                name={s <= (visit.rating || 5) ? 'star' : 'star-outline'}
                                                size={scale(16)}
                                                color="#F97316"
                                                style={{ marginRight: 1 }}
                                            />
                                        ))}
                                    </View>
                                    <Text style={styles.yourRatingLabel}>Your rating</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.rateButton, { backgroundColor: '#7C3AED' }]}
                                    onPress={(e) => {
                                        e.stopPropagation?.();
                                        setRatingModalVisit(visit);
                                    }}
                                >
                                    <Ionicons name="star-outline" size={scale(13)} color="#FFF" style={{ marginRight: scale(4) }} />
                                    <Text style={styles.rateButtonText}>Rate</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <View style={styles.visitHeader}>
                            <Image
                                source={{ uri: sanitizeImageUri(visit.companionPhoto, 'https://randomuser.me/api/portraits/women/1.jpg') }}
                                style={styles.visitCompanionPhoto}
                            />

                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: scale(3) }}>
                                    <Text style={styles.visitCompanionName}>{visit.companionName || 'Care Companion'}</Text>
                                    <ConnectContactButton
                                        name={visit.companionName || 'Care Companion'}
                                        role="Care Companion"
                                        phone={visit.companionPhone || null}
                                        photo={visit.companionPhoto}
                                    />
                                </View>
                                <Text style={styles.visitDate}>{formatDate(visit.dateStr)}</Text>
                                <Text style={styles.visitTime}>{formatTimeRange(visit.dateStr)}</Text>
                                <Text style={styles.visitDuration}>{`Duration: ${visit.scheduledDurationText || '60 mins'}`}</Text>
                            </View>

                            {/* Subscriber Rating - top-right aligned */}
                            {visit.rated && visit.rating ? (
                                <TouchableOpacity
                                    onPress={(e) => {
                                        e.stopPropagation?.();
                                        setRatingModalVisit(visit);
                                    }}
                                    style={styles.ratedBox}
                                    hitSlop={{ top: scale(6), bottom: scale(6), left: scale(6), right: scale(6) }}
                                >
                                    <View style={styles.starsRow}>
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Ionicons
                                                key={s}
                                                name={s <= (visit.rating || 5) ? 'star' : 'star-outline'}
                                                size={scale(16)}
                                                color="#F97316"
                                                style={{ marginRight: 1 }}
                                            />
                                        ))}
                                    </View>
                                    <Text style={styles.yourRatingLabel}>Your rating</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.rateButton}
                                    onPress={(e) => {
                                        e.stopPropagation?.();
                                        setRatingModalVisit(visit);
                                    }}
                                >
                                    <Ionicons name="star-outline" size={scale(13)} color="#FFF" style={{ marginRight: scale(4) }} />
                                    <Text style={styles.rateButtonText}>Rate</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Actual Check-In & Check-Out Timing Strip (if checked in) */}
                    {(visit.checkInTime || visit.checkOutTime) && (
                        <View style={styles.actualTimeStrip}>
                            {visit.checkInTime ? (
                                <View style={styles.timePoint}>
                                    <Ionicons name="log-in-outline" size={scale(14)} color="#059669" />
                                    <Text style={styles.timePointLabel}>In: </Text>
                                    <Text style={styles.timePointValue}>{visit.checkInTime}</Text>
                                </View>
                            ) : null}

                            {visit.checkOutTime ? (
                                <View style={styles.timePoint}>
                                    <Ionicons name="log-out-outline" size={scale(14)} color="#0284C7" />
                                    <Text style={styles.timePointLabel}>Out: </Text>
                                    <Text style={styles.timePointValue}>{visit.checkOutTime}</Text>
                                </View>
                            ) : null}

                            {visit.isGeoVerified ? (
                                <View style={styles.geoVerifiedChip}>
                                    <Ionicons name="shield-checkmark" size={scale(11)} color="#16A34A" />
                                    <Text style={styles.geoVerifiedText}>Geo-Verified</Text>
                                </View>
                            ) : null}
                        </View>
                    )}

                    {/* Beneficiary Rating Chip */}
                    {(visit.beneficiaryRating !== null && visit.beneficiaryRating !== undefined) && (
                        <View style={styles.beneficiaryRatingChip}>
                            <Ionicons name="person-outline" size={scale(13)} color="#7C3AED" style={{ marginRight: scale(5) }} />
                            <Text style={styles.beneficiaryRatingLabel}>Beneficiary: </Text>
                            {[1, 2, 3, 4, 5].map((s) => (
                                <Ionicons
                                    key={s}
                                    name={s <= (visit.beneficiaryRating || 0) ? 'star' : 'star-outline'}
                                    size={scale(13)}
                                    color="#7C3AED"
                                    style={{ marginRight: 1 }}
                                />
                            ))}
                            <Text style={styles.beneficiaryRatingValue}> {visit.beneficiaryRating}/5</Text>
                        </View>
                    )}

                    {/* Activities Pills */}
                    {!!visit.activities && visit.activities.length > 0 ? (
                        <View style={{ marginBottom: scale(16) }}>
                            <Text style={styles.visitSectionLabel}>Activities:</Text>
                            <View style={styles.activitiesTags}>
                                {visit.activities.map((a, j) => (
                                    <View key={j} style={styles.activityTag}>
                                        <Text style={styles.activityTagText}>{a}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : null}

                    {/* Vitals Blocks */}
                    {!!(visit.bp || visit.heartRate || visit.bloodSugar) ? (
                        <View style={styles.vitalsRow}>
                            {!!visit.bp ? (
                                <View style={styles.vitalChip}>
                                    <Text style={styles.vitalLabel}>BP</Text>
                                    <Text style={styles.vitalValue}>{visit.bp}</Text>
                                </View>
                            ) : null}
                            {!!visit.heartRate ? (
                                <View style={styles.vitalChip}>
                                    <Text style={styles.vitalLabel}>Heart Rate</Text>
                                    <Text style={styles.vitalValue}>{visit.heartRate}</Text>
                                </View>
                            ) : null}
                            {!!visit.bloodSugar ? (
                                <View style={styles.vitalChip}>
                                    <Text style={styles.vitalLabel}>Blood Sugar</Text>
                                    <Text style={styles.vitalValue}>{visit.bloodSugar}</Text>
                                </View>
                            ) : null}
                        </View>
                    ) : null}

                    {/* Notes Section */}
                    {visit.is3rdParty ? (
                        (visit.thirdPartyNotes || visit.notes) ? (
                            <View style={styles.thirdPartyNotesContainer}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: scale(3) }}>
                                    <Ionicons name="information-circle-outline" size={scale(13)} color="#4F46E5" style={{ marginRight: scale(4) }} />
                                    <Text style={styles.thirdPartyNotesLabel}>Partner Remarks:</Text>
                                </View>
                                <Text style={styles.visitNotes} numberOfLines={3}>
                                    {visit.thirdPartyNotes ? `${visit.thirdPartyNotes}${visit.notes ? ` • ${visit.notes}` : ''}` : visit.notes}
                                </Text>
                            </View>
                        ) : null
                    ) : (
                        (visit.visitSummary || visit.notes) ? (
                            <View style={{ marginTop: scale(4), marginBottom: scale(12) }}>
                                <Text style={styles.visitSectionLabel}>
                                    {visit.visitSummary ? 'Care Update (Family Connect):' : 'Notes:'}
                                </Text>
                                <Text style={styles.visitNotes} numberOfLines={2}>
                                    {visit.visitSummary || visit.notes}
                                </Text>
                            </View>
                        ) : null
                    )}

                    {/* Tap for Encounter Report CTA */}
                    <View style={[styles.cardCtaRow, visit.is3rdParty && styles.thirdPartyCtaRow]}>
                        <View style={[styles.cardCtaBadge, visit.is3rdParty && styles.thirdPartyCtaBadge]}>
                            <Ionicons name="document-text-outline" size={scale(13)} color={visit.is3rdParty ? '#4F46E5' : '#0369A1'} style={{ marginRight: scale(4) }} />
                            <Text style={[styles.cardCtaText, visit.is3rdParty && { color: '#4F46E5' }]}>
                                {visit.is3rdParty ? 'View Full Service Encounter Details' : 'View Full Visit Encounter Details'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={scale(16)} color={visit.is3rdParty ? '#4F46E5' : '#0369A1'} />
                    </View>
                </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: scale(16),
        paddingTop: scale(20),
        paddingBottom: scale(15),
    },
    emptyTab: { alignItems: 'center', paddingVertical: scale(40) },
    emptyTabText: { fontSize: scale(14), color: '#9CA3AF', marginTop: scale(10) },

    visitCard: {
        backgroundColor: '#EFEFEF',
        borderRadius: scale(16),
        padding: scale(16),
        marginBottom: scale(16),
    },

    visitHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: scale(14) },
    visitCompanionPhoto: { width: scale(52), height: scale(52), borderRadius: scale(26), marginRight: scale(12), backgroundColor: '#D1D5DB' },
    visitCompanionName: { fontSize: scale(17), fontWeight: '700', color: '#111111', marginBottom: scale(2) },
    visitDate: { fontSize: scale(13), color: '#555555', fontWeight: '400', marginBottom: scale(4) },
    visitDuration: { fontSize: scale(13), color: '#555555', fontWeight: '400' },
    visitTime: { fontSize: scale(13), color: '#555555', fontWeight: '400', marginBottom: scale(2) },

    timingBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: scale(6), flexWrap: 'wrap', marginBottom: scale(4) },
    scheduledPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: scale(6),
        paddingHorizontal: scale(7),
        paddingVertical: scale(2),
    },
    scheduledPillText: { fontSize: scale(12), fontWeight: '600', color: '#B45309' },

    actualTimeStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: scale(8),
        paddingHorizontal: scale(10),
        paddingVertical: scale(7),
        marginBottom: scale(12),
        gap: scale(12),
        borderWidth: 1,
        borderColor: '#E5E7EB',
        flexWrap: 'wrap',
    },
    timePoint: { flexDirection: 'row', alignItems: 'center' },
    timePointLabel: { fontSize: scale(12), color: '#6B7280', fontWeight: '500', marginLeft: scale(3) },
    timePointValue: { fontSize: scale(12), color: '#111827', fontWeight: '700' },
    geoVerifiedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DCFCE7',
        borderRadius: scale(4),
        paddingHorizontal: scale(6),
        paddingVertical: scale(2),
        marginLeft: 'auto',
        gap: scale(3),
    },
    geoVerifiedText: { fontSize: scale(11), color: '#15803D', fontWeight: '600' },

    ratedBox: { alignItems: 'center' },
    yourRatingLabel: { fontSize: scale(10), color: '#6B7280', marginTop: scale(3), fontWeight: '500' },
    starsRow: { flexDirection: 'row', alignItems: 'center' },
    rateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF5B0A',
        borderRadius: scale(12),
        paddingHorizontal: scale(12),
        paddingVertical: scale(8),
    },
    rateButtonText: { color: '#FFF', fontSize: scale(13), fontWeight: '700' },

    // Beneficiary rating chip
    beneficiaryRatingChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EDE9FE',
        borderRadius: scale(8),
        paddingHorizontal: scale(10),
        paddingVertical: scale(6),
        marginBottom: scale(14),
        alignSelf: 'flex-start',
    },
    beneficiaryRatingLabel: { fontSize: scale(12), color: '#7C3AED', fontWeight: '600' },
    beneficiaryRatingValue: { fontSize: scale(12), color: '#7C3AED', fontWeight: '700' },

    visitSectionLabel: { fontSize: scale(14), fontWeight: '700', color: '#111111', marginBottom: scale(8) },
    activitiesTags: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
    activityTag: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(6),
        paddingHorizontal: scale(12),
        paddingVertical: scale(6),
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    activityTagText: { fontSize: scale(13), color: '#111111', fontWeight: '400' },

    vitalsRow: { flexDirection: 'row', gap: scale(8), marginBottom: scale(14) },
    vitalChip: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(8),
        paddingVertical: scale(10),
        paddingHorizontal: scale(12),
        flex: 1,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    vitalLabel: { fontSize: scale(11), color: '#6B7280', fontWeight: '400', marginBottom: scale(4) },
    vitalValue: { fontSize: scale(15), fontWeight: '800', color: '#111111' },

    visitNotes: { fontSize: scale(14), color: '#444444', lineHeight: scale(21), fontWeight: '400' },

    // Tap Encounter CTA
    cardCtaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: scale(10),
        paddingHorizontal: scale(14),
        paddingVertical: scale(10),
        borderWidth: 1,
        borderColor: '#DBEAFE',
        marginTop: scale(4),
    },
    cardCtaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardCtaText: {
        fontSize: scale(13),
        fontWeight: '600',
        color: '#0369A1',
    },

    // ── 3rd Party Visit Specific Styles ──
    thirdPartyVisitCard: {
        backgroundColor: '#FAF9FF',
        borderColor: '#E0E7FF',
        borderLeftWidth: 4,
        borderLeftColor: '#6366F1',
    },
    thirdPartyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(12),
    },
    thirdPartyServiceName: {
        fontSize: scale(17),
        fontWeight: '700',
        color: '#1E1B4B',
        marginBottom: scale(2),
    },
    thirdPartyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(3),
        backgroundColor: '#EEF2FF',
        paddingHorizontal: scale(6),
        paddingVertical: scale(2),
        borderRadius: scale(6),
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    thirdPartyBadgeText: {
        fontSize: scale(10),
        fontWeight: '700',
        color: '#4F46E5',
    },
    partnerSubtitle: {
        fontSize: scale(11),
        fontWeight: '600',
        color: '#6366F1',
    },
    thirdPartyNotesContainer: {
        backgroundColor: '#EEF2FF',
        borderRadius: scale(8),
        padding: scale(10),
        marginTop: scale(4),
        marginBottom: scale(12),
        borderWidth: 1,
        borderColor: '#E0E7FF',
    },
    thirdPartyNotesLabel: {
        fontSize: scale(12),
        fontWeight: '700',
        color: '#4338CA',
    },
    thirdPartyCtaRow: {
        backgroundColor: '#F5F3FF',
        borderColor: '#DDD6FE',
    },
    thirdPartyCtaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    // ── Rating Modal ──────────────────────────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(24),
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: scale(20),
        padding: scale(28),
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(10) },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 12,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(8),
        gap: scale(8),
    },
    modalTitle: {
        fontSize: scale(18),
        fontWeight: '700',
        color: '#111827',
    },
    modalSubtitle: {
        fontSize: scale(14),
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: scale(24),
        lineHeight: scale(20),
    },
    modalStars: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(12),
    },
    ratingLabel: {
        fontSize: scale(15),
        fontWeight: '600',
        color: '#F97316',
        marginBottom: scale(24),
    },
    modalActions: {
        flexDirection: 'row',
        gap: scale(12),
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: scale(14),
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: scale(15),
        fontWeight: '600',
        color: '#6B7280',
    },
    submitBtn: {
        flex: 1,
        paddingVertical: scale(14),
        borderRadius: scale(12),
        backgroundColor: '#FF5B0A',
        alignItems: 'center',
    },
    submitBtnDisabled: {
        backgroundColor: '#FED7AA',
    },
    submitBtnText: {
        fontSize: scale(15),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    highlightedVisitCard: {
        borderColor: '#FE6700',
        borderWidth: 2,
        backgroundColor: '#FFFBF7',
        shadowColor: '#FE6700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    highlightBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#FFE8CE',
        borderColor: '#FDBA74',
        borderWidth: 1,
        borderRadius: scale(6),
        paddingHorizontal: scale(8),
        paddingVertical: scale(3),
        marginBottom: scale(10),
    },
    highlightBadgeText: {
        fontSize: scale(11),
        fontWeight: '700',
        color: '#C2410C',
    },
});

export default TimelineTab;
