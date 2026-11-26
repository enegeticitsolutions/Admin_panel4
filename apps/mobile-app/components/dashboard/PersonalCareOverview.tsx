import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { HomeColors, HomeShadows } from '@/constants/homeTheme';
import { useSelectedBeneficiary } from '@/contexts/SelectedBeneficiaryContext';

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
    bio?: string;
    photo?: string | null;
    phone?: string | null;
  } | null;
  todaysMedications?: Array<{
    id: string;
    name: string;
    dosage?: string;
    condition?: string;
    time?: string;
    completed?: boolean;
    adherenceScore?: number;
  }>;
}

interface PersonalCareOverviewProps {
  data: PersonalCareData;
  onViewTeam: () => void;
  onViewAllMeds: () => void;
  onSelectMed?: (medId: string) => void;
  onOpenCareCircle?: () => void;
}

export const PersonalCareOverview: React.FC<PersonalCareOverviewProps> = ({
  data,
  onViewTeam,
  onViewAllMeds,
}) => {
  const { selectedBeneficiary } = useSelectedBeneficiary();
  // Extract next medication
  const nextMed =
    data.todaysMedications && data.todaysMedications.length > 0
      ? data.todaysMedications[0]
      : null;

  const medName = nextMed ? `${nextMed.name}${nextMed.dosage ? ` ${nextMed.dosage}` : ''}` : 'No medication scheduled';
  const medTiming = nextMed ? (nextMed.time ? `${nextMed.condition ? `${nextMed.condition} · ` : ''}${nextMed.time}` : 'Scheduled for today') : 'All doses complete or none prescribed';

  // Parse adherence value (e.g., '95%' -> 95)
  const adherenceRaw = (data.adherence || '0%').replace('%', '').trim();
  const adherenceNum = Math.min(100, Math.max(0, parseInt(adherenceRaw, 10) || 0));
  const adherenceDisplay = `${adherenceNum}%`;

  const coordinator =
    selectedBeneficiary && !selectedBeneficiary.isSelf
      ? selectedBeneficiary.careCoordinator ?? null
      : selectedBeneficiary?.careCoordinator ?? data.careCoordinator ?? null;

  const handlePhonePress = () => {
    const cleanedPhone = coordinator?.phone?.replace(/[^0-9+]/g, '');
    if (!cleanedPhone) {
      Alert.alert('Contact unavailable', 'No phone number is available for your care coordinator.');
      return;
    }
    Linking.openURL(`tel:${cleanedPhone}`);
  };

  return (
    <View style={styles.container}>
      {/* ── Section Title Row ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionCategory}>PERSONAL WELLNESS</Text>
        <Text style={styles.sectionTitle}>Today for you</Text>
      </View>

      {/* ── Dark Navy Medication & Adherence Card ── */}
      <View style={styles.darkCard}>
        {/* Top: Next medication & icon */}
        <View style={styles.darkTopRow}>
          <View style={styles.medTextCol}>
            <Text style={styles.nextMedLabel}>Next medication</Text>
            <Text style={styles.medTitle} numberOfLines={1}>
              {medName}
            </Text>
            <Text style={styles.medTimingText} numberOfLines={1}>
              {medTiming}
            </Text>
          </View>

          <View style={styles.pillIconBox}>
            <MaterialCommunityIcons name="pill" size={24} color="#FFA15F" />
          </View>
        </View>

        {/* Middle: Weekly Adherence Progress */}
        <View style={styles.adherenceSection}>
          <View style={styles.adherenceTextRow}>
            <Text style={styles.adherenceLabel}>Weekly adherence</Text>
            <Text style={styles.adherenceValue}>{adherenceDisplay}</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${adherenceNum}%` }]} />
          </View>
        </View>

        {/* Bottom Button */}
        <TouchableOpacity
          style={styles.openScheduleBtn}
          onPress={onViewAllMeds}
          activeOpacity={0.88}
        >
          <Text style={styles.openScheduleBtnText}>Open medication schedule</Text>
        </TouchableOpacity>
      </View>

      {/* ── Care Team Section ── */}
      <View style={styles.careTeamSection}>
        <View style={styles.careTeamHeaderRow}>
          <Text style={styles.careTeamTitle}>Care Team</Text>
          <TouchableOpacity onPress={onViewTeam} activeOpacity={0.75}>
            <Text style={styles.viewTeamLink}>View team</Text>
          </TouchableOpacity>
        </View>

        {coordinator ? (
          <View style={styles.coordinatorCard}>
            <View style={styles.stethoscopeCircle}>
              <MaterialCommunityIcons name="stethoscope" size={22} color={HomeColors.mintIcon} />
            </View>

            <View style={styles.coordinatorInfo}>
              <Text style={styles.coordinatorRole}>{coordinator.role || 'Care coordinator'}</Text>
              <Text style={styles.coordinatorName} numberOfLines={1}>
                {coordinator.name}
              </Text>
            </View>

            <View style={styles.contactActions}>
              <TouchableOpacity
                style={styles.circleBtnPeach}
                onPress={handlePhonePress}
                activeOpacity={0.8}
                accessibilityLabel={`Call ${coordinator.name}`}
                accessibilityRole="button"
              >
                <Feather name="phone" size={19} color={HomeColors.brandOrange} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.coordinatorCard}>
            <View style={styles.stethoscopeCircle}>
              <MaterialCommunityIcons name="stethoscope" size={22} color={HomeColors.mintIcon} />
            </View>
            <View style={styles.coordinatorInfo}>
              <Text style={styles.coordinatorRole}>Primary Care Coordinator</Text>
              <Text style={styles.coordinatorEmptyText} numberOfLines={1}>
                Not assigned yet
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 28,
  },
  sectionHeader: {
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
  darkCard: {
    width: '100%',
    backgroundColor: HomeColors.cardDark,
    borderRadius: 26,
    padding: 20,
    ...HomeShadows.darkCard,
  },
  darkTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  medTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  nextMedLabel: {
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  medTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 26,
    color: '#FFFFFF',
    marginTop: 4,
  },
  medTimingText: {
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 4,
  },
  pillIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adherenceSection: {
    marginTop: 20,
  },
  adherenceTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adherenceLabel: {
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  adherenceValue: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    color: HomeColors.adherenceText,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: HomeColors.progressTrack,
    borderRadius: 36,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: HomeColors.adherenceGreen,
    borderRadius: 36,
  },
  openScheduleBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  openScheduleBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
    color: HomeColors.cardDark,
  },
  careTeamSection: {
    marginTop: 22,
  },
  careTeamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  careTeamTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: HomeColors.textPrimary,
  },
  viewTeamLink: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: HomeColors.brandOrange,
  },
  coordinatorCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HomeColors.cardWhite,
    borderRadius: 24,
    borderWidth: 1.08,
    borderColor: HomeColors.borderSubtle,
    padding: 16,
    gap: 12,
    ...HomeShadows.card,
  },
  coordinatorEmptyText: {
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: HomeColors.textMuted,
    marginTop: 2,
  },
  stethoscopeCircle: {
    width: 44,
    height: 44,
    borderRadius: 36,
    backgroundColor: HomeColors.mintBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordinatorInfo: {
    flex: 1,
    flexDirection: 'column',
  },
  coordinatorRole: {
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
    color: HomeColors.textMuted,
  },
  coordinatorName: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    color: HomeColors.textPrimary,
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleBtnPeach: {
    width: 44,
    height: 44,
    borderRadius: 36,
    backgroundColor: HomeColors.peachBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
