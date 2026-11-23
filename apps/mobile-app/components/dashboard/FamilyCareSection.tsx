import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { HomeColors, HomeShadows } from '@/constants/homeTheme';
import { ProfileAccessActionButtons } from '@/components/access';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';

export interface BeneficiaryItem {
  id: string;
  name: string;
  relationship?: string;
  subscriberRelationship?: string;
  photo?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  packageStatus?: 'active' | 'expired' | 'pending' | 'none';
  verificationStatus?: string;
  isSelf?: boolean;
  accessRole?: 'SELF' | 'MANAGER' | 'EDITOR' | 'VIEWER';
  isCareCircleMember?: boolean;
  careCircleRole?: string;
  canEditDetails?: boolean;
  careCircleMembersCount?: number;
  // Optional health & visit info from subscriber dashboard
  latestVitals?: {
    bloodPressure?: string;
    bloodPressureStatus?: string;
    pulseRate?: string | number;
    pulseStatus?: string;
    spo2?: string | number;
    spo2Status?: string;
    bloodGlucose?: string | number;
    temperature?: string | number;
  };
  nextVisit?: {
    scheduledTime?: string;
    companionName?: string;
    status?: string;
  };
  visits?: Array<{
    scheduledTime?: string;
    primaryCC?: { user?: { name?: string } };
    companionName?: string;
    status?: string;
  }>;
}

interface FamilyCareSectionProps {
  beneficiaries: BeneficiaryItem[];
  remainingHours?: number;
  visitsThisWeek?: number;
  onSelectBeneficiary: (beneficiary: BeneficiaryItem) => void;
  onAddMember: () => void;
  onOpenFamilyConnect?: () => void;
  onOpenCareCircle?: (beneficiary: BeneficiaryItem) => void;
  onOpenJoinCircle?: () => void;
  pendingAccessRequestsCount?: number;
  onAccessChanged?: () => void;
}

export const FamilyCareSection: React.FC<FamilyCareSectionProps> = ({
  beneficiaries,
  onSelectBeneficiary,
  onAddMember,
  onOpenCareCircle,
  onOpenJoinCircle,
  pendingAccessRequestsCount = 0,
  onAccessChanged,
}) => {
  // Track currently selected family member in the pills row
  const [selectedIndex, setSelectedIndex] = useState(0);

  const getDisplayAge = (b: BeneficiaryItem): string => {
    if (b.dateOfBirth) {
      try {
        const dob = new Date(b.dateOfBirth);
        if (!isNaN(dob.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const m = today.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
          return `${age} yrs`;
        }
      } catch (_) {}
    }
    return b.age ? `${b.age} yrs` : '';
  };

  const getInitials = (name: string): string => {
    if (!name) return 'FM';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatVisitSchedule = (dateStr?: string) => {
    if (!dateStr) return { day: 'Not Scheduled', time: '' };
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { day: 'Scheduled', time: '' };
      const now = new Date();
      const isTomorrow =
        d.getDate() === now.getDate() + 1 &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();

      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return { day: 'Today', time: `· ${timeStr}` };
      if (isTomorrow) return { day: 'Tomorrow', time: `· ${timeStr}` };
      const dayName = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      return { day: dayName, time: `· ${timeStr}` };
    } catch {
      return { day: 'Scheduled', time: '' };
    }
  };

  if (!beneficiaries || beneficiaries.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionCategory}>FAMILY CARE</Text>
            <Text style={styles.sectionTitle}>Loved ones</Text>
          </View>
          <TouchableOpacity style={styles.addMemberHeaderBtn} onPress={onAddMember} activeOpacity={0.75}>
            <Feather name="plus" size={16} color={HomeColors.brandOrange} />
            <Text style={styles.addMemberHeaderText}>Add member</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="people-outline" size={28} color={HomeColors.brandOrange} />
          </View>
          <Text style={styles.emptyTitle}>No Family Members Added</Text>
          <Text style={styles.emptySub}>
            Add your parents or family members to monitor their health, coordinate visits, and share care circles.
          </Text>
          <View style={styles.emptyActionsRow}>
            <TouchableOpacity style={styles.emptyPrimaryBtn} onPress={onAddMember} activeOpacity={0.85}>
              <Ionicons name="person-add-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyPrimaryBtnText}>Add Member</Text>
            </TouchableOpacity>

            {onOpenJoinCircle && (
              <TouchableOpacity style={styles.emptySecondaryBtn} onPress={onOpenJoinCircle} activeOpacity={0.85}>
                <Ionicons name="key-outline" size={15} color={HomeColors.brandOrange} style={{ marginRight: 6 }} />
                <Text style={styles.emptySecondaryBtnText}>Join Circle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ProfileAccessActionButtons pendingCount={pendingAccessRequestsCount} onChanged={onAccessChanged} />
      </View>
    );
  }

  // Active selected beneficiary
  const currentBen = beneficiaries[selectedIndex] || beneficiaries[0];
  const ageStr = getDisplayAge(currentBen);
  const relStr = currentBen.relationship || currentBen.subscriberRelationship || 'Family Member';
  const circleCount = currentBen.careCircleMembersCount || 1;

  // Next visit info
  const rawVisit =
    currentBen.nextVisit ||
    (currentBen.visits && currentBen.visits.length > 0 ? currentBen.visits[0] : null);
  const companion =
    rawVisit?.companionName ||
    (rawVisit as any)?.primaryCC?.user?.name ||
    'Care Coordinator';
  const visitSchedule = formatVisitSchedule(rawVisit?.scheduledTime);

  // Vitals info
  const bpVal = currentBen.latestVitals?.bloodPressure || '124/82';
  const bpStatus = currentBen.latestVitals?.bloodPressureStatus || 'Normal';
  const pulseVal = currentBen.latestVitals?.pulseRate ? `${currentBen.latestVitals.pulseRate}` : '74';
  const spo2Val = currentBen.latestVitals?.spo2 ? `${currentBen.latestVitals.spo2}%` : '98%';

  return (
    <View style={styles.container}>
      {/* ── Section Title Row ── */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionCategory}>FAMILY CARE</Text>
          <Text style={styles.sectionTitle}>Loved ones</Text>
        </View>
        <TouchableOpacity style={styles.addMemberHeaderBtn} onPress={onAddMember} activeOpacity={0.75}>
          <Feather name="plus" size={16} color={HomeColors.brandOrange} />
          <Text style={styles.addMemberHeaderText}>Add member</Text>
        </TouchableOpacity>
      </View>

      {/* ── Horizontal Member Selector Pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.memberPillsScroll}
      >
        {beneficiaries.map((b, idx) => {
          const isSelected = idx === selectedIndex;
          const initials = getInitials(b.name);
          const displayLabel = b.relationship || b.name.split(' ')[0];

          return (
            <TouchableOpacity
              key={b.id || `member-pill-${idx}`}
              style={[styles.memberPill, isSelected ? styles.memberPillActive : styles.memberPillInactive]}
              onPress={() => setSelectedIndex(idx)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.pillAvatarCircle,
                  isSelected ? styles.pillAvatarActive : styles.pillAvatarInactive,
                ]}
              >
                <Text
                  style={[
                    styles.pillAvatarText,
                    isSelected ? { color: HomeColors.brandOrange } : { color: '#5C6370' },
                  ]}
                >
                  {initials}
                </Text>
              </View>
              <Text
                style={[
                  styles.pillLabelText,
                  isSelected ? { color: HomeColors.brandOrange } : { color: '#5C6370' },
                ]}
              >
                {displayLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Selected Loved One Detail Card ── */}
      <View style={styles.lovedOneCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.avatarLarge}>
            {currentBen.photo ? (
              <Image
                source={{
                  uri: sanitizeImageUri(
                    currentBen.photo,
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(currentBen.name)}&background=FDE7D5&color=8D3C11&bold=true`
                  ),
                }}
                style={styles.avatarLargeImg}
              />
            ) : (
              <Text style={styles.avatarLargeText}>{getInitials(currentBen.name)}</Text>
            )}
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.seniorName} numberOfLines={1}>
              {currentBen.name}
            </Text>
            <Text style={styles.seniorMeta}>
              {ageStr ? `${ageStr} · ` : ''}
              {relStr}
            </Text>
          </View>

          {onOpenCareCircle && (
            <TouchableOpacity
              style={styles.careCirclePill}
              onPress={() => onOpenCareCircle(currentBen)}
              activeOpacity={0.8}
            >
              <Feather name="users" size={13} color={HomeColors.blueText} style={{ marginRight: 4 }} />
              <Text style={styles.careCirclePillText}>Care Circle ({circleCount})</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.cardDivider} />

        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Next Visit Sub-card */}
          <TouchableOpacity
            style={styles.visitSubCard}
            onPress={() => onSelectBeneficiary(currentBen)}
            activeOpacity={0.85}
          >
            <View style={styles.calendarIconSquare}>
              <Feather name="calendar" size={20} color={HomeColors.brandOrange} />
            </View>

            <View style={styles.visitInfo}>
              <Text style={styles.visitLabel}>Next Saathi visit</Text>
              <Text style={styles.visitTime}>
                {visitSchedule.day} {visitSchedule.time}
              </Text>
              <Text style={styles.visitCompanion}>with {companion}</Text>
            </View>

            <Feather name="chevron-right" size={20} color={HomeColors.brandOrange} />
          </TouchableOpacity>

          {/* Compact Vitals 3-Box Row */}
          <View style={styles.vitalsRow}>
            {/* Box 1: BP */}
            <View style={styles.vitalBox}>
              <Text style={styles.vitalValue}>{bpVal}</Text>
              <Text style={styles.vitalLabel}>BP</Text>
              <Text style={styles.vitalStatus}>{bpStatus}</Text>
            </View>

            {/* Box 2: Pulse */}
            <View style={styles.vitalBox}>
              <Text style={styles.vitalValue}>{pulseVal}</Text>
              <Text style={styles.vitalLabel}>Pulse</Text>
              <Text style={styles.vitalStatus}>bpm</Text>
            </View>

            {/* Box 3: SpO2 */}
            <View style={styles.vitalBox}>
              <Text style={styles.vitalValue}>{spo2Val}</Text>
              <Text style={styles.vitalLabel}>SpO₂</Text>
              <Text style={styles.vitalStatus}>Good</Text>
            </View>
          </View>
        </View>

        {/* Card Footer */}
        <TouchableOpacity
          style={styles.cardFooterBtn}
          onPress={() => onSelectBeneficiary(currentBen)}
          activeOpacity={0.8}
        >
          <Text style={styles.cardFooterText}>View full health profile</Text>
          <Feather name="arrow-right" size={18} color={HomeColors.brandOrange} />
        </TouchableOpacity>
      </View>

      <ProfileAccessActionButtons pendingCount={pendingAccessRequestsCount} onChanged={onAccessChanged} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  sectionCategory: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.56,
    color: HomeColors.brandOrange,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 21,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: HomeColors.textPrimary,
  },
  addMemberHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  addMemberHeaderText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: HomeColors.brandOrange,
  },
  memberPillsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 16,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 16,
    paddingLeft: 8,
    borderRadius: 36,
    borderWidth: 1.08,
    height: 48,
    gap: 8,
  },
  memberPillActive: {
    backgroundColor: HomeColors.brandOrangeSoft,
    borderColor: HomeColors.brandOrange,
  },
  memberPillInactive: {
    backgroundColor: HomeColors.cardWhite,
    borderColor: HomeColors.borderSubtle,
  },
  pillAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillAvatarActive: {
    backgroundColor: '#FDE7D5',
  },
  pillAvatarInactive: {
    backgroundColor: '#E7F1ED',
  },
  pillAvatarText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
  },
  pillLabelText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
  lovedOneCard: {
    width: '100%',
    backgroundColor: HomeColors.cardWhite,
    borderRadius: 26,
    borderWidth: 1.08,
    borderColor: HomeColors.borderSubtle,
    overflow: 'hidden',
    ...HomeShadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FDE7D5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarLargeImg: {
    width: '100%',
    height: '100%',
  },
  avatarLargeText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 24,
    color: '#8D3C11',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'column',
  },
  seniorName: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 23,
    color: HomeColors.textPrimary,
  },
  seniorMeta: {
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: HomeColors.textMuted,
    marginTop: 2,
  },
  careCirclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HomeColors.blueBg,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 36,
  },
  careCirclePillText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    color: HomeColors.blueText,
  },
  cardDivider: {
    height: 1.08,
    backgroundColor: HomeColors.borderSubtle,
    marginHorizontal: 20,
  },
  cardBody: {
    padding: 20,
  },
  visitSubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F0',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  calendarIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  visitInfo: {
    flex: 1,
    flexDirection: 'column',
  },
  visitLabel: {
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: HomeColors.textMuted,
  },
  visitTime: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: HomeColors.textPrimary,
    marginTop: 2,
  },
  visitCompanion: {
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: HomeColors.textMuted,
    marginTop: 2,
  },
  vitalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  vitalBox: {
    flex: 1,
    height: 92,
    backgroundColor: HomeColors.vitalsBoxBg,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  vitalValue: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    color: HomeColors.vitalsValueGreen,
  },
  vitalLabel: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 16,
    color: HomeColors.vitalsLabelGreen,
    marginTop: 4,
  },
  vitalStatus: {
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 15,
    color: HomeColors.vitalsUnitGreen,
    marginTop: 2,
  },
  cardFooterBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
    borderTopWidth: 1.08,
    borderTopColor: HomeColors.borderSubtle,
  },
  cardFooterText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: '#333B47',
  },
  emptyCard: {
    backgroundColor: HomeColors.cardWhite,
    borderRadius: 24,
    borderWidth: 1.08,
    borderColor: HomeColors.borderSubtle,
    padding: 24,
    alignItems: 'center',
    ...HomeShadows.card,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: HomeColors.brandOrangeSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 17,
    color: HomeColors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: HomeColors.textMuted,
    textAlign: 'center',
    marginBottom: 18,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HomeColors.brandOrange,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyPrimaryBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 13,
    color: '#FFFFFF',
  },
  emptySecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HomeColors.brandOrangeSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptySecondaryBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 13,
    color: HomeColors.brandOrange,
  },
});
