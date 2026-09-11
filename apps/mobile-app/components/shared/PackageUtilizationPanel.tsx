import React from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatHours } from '@/utils/timeFormat';

export interface BenefitBalance {
  benefitId: string;
  benefitName: string;
  unitLabel: string;
  benefitTypeName: string | null;
  baseAllocation?: number;
  rolloverAllocation?: number;
  totalUnits: number;
  usedUnits: number;
  remainingUnits: number;
  usagePercent: number;
  isLowBalance: boolean;
  isExhausted: boolean;
}

export interface LogEntry {
  id: string;
  visitId: string | null;
  hoursConsumed: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  loggedAt: string;
  careCompanionName: string;
  ccType: string | null;
  visitStatus: string | null;
  actualMinutes: number | null;
  isRequest?: boolean;
}

export interface DetailedUtilization {
  type: 'detail';
  beneficiaryId: string;
  beneficiaryName?: string;
  subscription: {
    id: string;
    packageName: string;
    packageType: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  } | null;
  periodInfo?: {
    periodId: string;
    periodNumber: number;
    totalPeriods: number;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  benefits: BenefitBalance[];
  recentLogs: LogEntry[];
}

interface Props {
  data: DetailedUtilization | null;
  selectedBenefitId?: string | null;
  onSelectBenefit?: (benefit: BenefitBalance) => void;
}

export default function PackageUtilizationPanel({ data, selectedBenefitId, onSelectBenefit }: Props) {
  if (!data || !data.subscription) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>No Active Subscription</Text>
        <Text style={styles.emptySubtitle}>There are no active packages to track utilization for.</Text>
      </View>
    );
  }

  const { subscription, periodInfo, benefits, recentLogs } = data;
  const hasWarnings = benefits.some((b) => b.isLowBalance || b.isExhausted);
  const exhaustedCount = benefits.filter(b => b.isExhausted).length;
  const lowCount = benefits.filter(b => b.isLowBalance).length;

  return (
    <View style={styles.container}>
      {/* Monthly Cycle Progress Card */}
      {periodInfo && (
        <View style={styles.periodBanner}>
          <View style={styles.periodHeader}>
            <View style={styles.periodTag}>
              <Ionicons name="calendar" size={14} color="#FF5B0A" />
              <Text style={styles.periodTagText}>Month {periodInfo.periodNumber} of {periodInfo.totalPeriods}</Text>
            </View>
            <Text style={styles.periodRenewalText}>
              Renews {new Date(periodInfo.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <Text style={styles.periodSubText}>
            Monthly quotas refresh on renewal date. Up to 1 month of unused care rolls forward automatically.
          </Text>
        </View>
      )}

      {/* Warning Banner */}
      {hasWarnings && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#D97706" />
          <Text style={styles.warningText}>
            {exhaustedCount > 0 
              ? `${exhaustedCount} benefit(s) exhausted — renewal or top-up needed`
              : `${lowCount} benefit(s) running low (< 20% remaining)`}
          </Text>
        </View>
      )}

      {/* Circular Quick-Stat Summary Rings Carousel */}
      {benefits.length > 0 && (
        <View style={styles.carouselContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselScroll}
          >
            {benefits.map((b) => {
              const isSelected = selectedBenefitId === b.benefitId;
              const isHour = (b.unitLabel || '').toLowerCase().includes('hour') || (b.unitLabel || '').toLowerCase().includes('hr');
              const remainDisplay = isHour ? formatHours(b.remainingUnits) : `${b.remainingUnits}`;
              const totalDisplay = isHour ? formatHours(b.totalUnits) : `${b.totalUnits}`;

              const ringBorderColor = b.isExhausted 
                ? '#EF4444' 
                : b.isLowBalance 
                  ? '#F59E0B' 
                  : isSelected 
                    ? '#FF5B0A' 
                    : '#10B981';

              const ringBg = b.isExhausted 
                ? '#FEF2F2' 
                : b.isLowBalance 
                  ? '#FEFCE8' 
                  : isSelected 
                    ? '#FFF7ED' 
                    : '#F0FDF4';

              return (
                <TouchableOpacity
                  key={`ring-${b.benefitId}`}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (b.isExhausted || b.remainingUnits <= 0) {
                      const msg = `Benefit "${b.benefitName}" is exhausted. Please connect with support team to renew or top up your package.`;
                      if (Platform.OS === 'web') {
                        window.alert(`Benefit Exhausted\n\n${msg}`);
                      } else {
                        Alert.alert('Benefit Exhausted', msg);
                      }
                      return;
                    }
                    onSelectBenefit?.(b);
                  }}
                  style={styles.ringCard}
                >
                  <View style={[styles.ringCircle, { borderColor: ringBorderColor, backgroundColor: ringBg }]}>
                    <Text style={[styles.ringValue, b.isExhausted && { color: '#DC2626' }]}>
                      {remainDisplay}
                    </Text>
                    <Text style={styles.ringSubValue} numberOfLines={1}>
                      / {totalDisplay} {b.unitLabel?.replace(/^per\s+/i, '')}
                    </Text>
                  </View>

                  <Text style={styles.ringName} numberOfLines={2}>
                    {b.benefitName}
                  </Text>

                  {b.isExhausted ? (
                    <Text style={styles.ringExhaustedBadge}>EXHAUSTED</Text>
                  ) : isSelected ? (
                    <Text style={styles.ringSelectedBadge}>SELECTED</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Benefits List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="pie-chart" size={20} color="#FF5B0A" />
          <Text style={styles.sectionTitle}>Benefit Balances</Text>
        </View>

        {benefits.length > 0 ? (
          benefits.map((b) => {
            const isSelected = selectedBenefitId === b.benefitId;
            const hasRollover = (b.rolloverAllocation ?? 0) > 0;

            return (
              <TouchableOpacity 
                key={b.benefitId} 
                activeOpacity={0.85}
                onPress={() => {
                  if (b.isExhausted || b.remainingUnits <= 0) {
                    const msg = `Benefit "${b.benefitName}" is exhausted. Please connect with support team to renew or top up your package.`;
                    if (Platform.OS === 'web') {
                      window.alert(`Benefit Exhausted\n\n${msg}`);
                    } else {
                      Alert.alert('Benefit Exhausted', msg);
                    }
                    return;
                  }
                  onSelectBenefit?.(b);
                }}
                style={[
                  styles.benefitCard, 
                  b.isExhausted ? styles.cardExhausted : (b.isLowBalance ? styles.cardLow : {}),
                  isSelected && styles.cardSelected
                ]}
              >
                <View style={styles.benefitHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.benefitName}>{b.benefitName}</Text>
                    {hasRollover && (
                      <View style={styles.rolloverBadge}>
                        <Ionicons name="repeat-outline" size={12} color="#0284C7" />
                        <Text style={styles.rolloverBadgeText}>
                          Includes +{b.rolloverAllocation} rollover
                        </Text>
                      </View>
                    )}
                  </View>

                  {b.isExhausted ? (
                    <View style={styles.badgeExhausted}><Text style={styles.badgeTextExhausted}>EXHAUSTED</Text></View>
                  ) : b.isLowBalance ? (
                    <View style={styles.badgeLow}><Text style={styles.badgeTextLow}>LOW</Text></View>
                  ) : (
                    <View style={styles.badgeOk}><Text style={styles.badgeTextOk}>OK</Text></View>
                  )}
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressTrack}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${b.isExhausted ? 100 : Math.min(100, Math.max(0, b.usagePercent))}%`,
                          backgroundColor: b.isExhausted ? '#EF4444' : (b.isLowBalance ? '#F59E0B' : '#10B981')
                        }
                      ]} 
                    />
                  </View>
                </View>

                <View style={styles.benefitFooter}>
                  {
                    (() => {
                      const lbl = (b.unitLabel || '').toLowerCase();
                      const isHourType = lbl.includes('hour') || lbl.includes('hr');
                      const usedStr = isHourType ? formatHours(b.usedUnits) : `${b.usedUnits}`;
                      const remainStr = isHourType ? formatHours(b.remainingUnits) : `${b.remainingUnits}`;
                      return (
                        <Text style={styles.benefitStats}>{usedStr} used · {remainStr} remaining</Text>
                      );
                    })()
                  }
                  <Text style={styles.benefitUnit}>{b.unitLabel}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.emptySubText}>No structured benefits found for this package.</Text>
        )}
      </View>

      {/* Activity Log */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="list" size={20} color="#FF5B0A" />
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Text style={styles.logCount}>{recentLogs.length} entries</Text>
        </View>

        {recentLogs.length > 0 ? (
          recentLogs.map((log) => {
            const isHours = (log.hoursConsumed ?? 0) > 0 || log.ccType === 'SATHI_COMPANION' || log.ccType === 'SATHI_HOURS';
            const billMinutes = log.actualMinutes != null
              ? log.actualMinutes
              : (log.hoursConsumed ? Math.round(log.hoursConsumed * 60) : null);
            
            const companionLabel = (log.careCompanionName && log.careCompanionName !== 'Unknown')
              ? log.careCompanionName
              : (log.description?.toLowerCase().includes('sathi') ? 'Sathi Volunteer' : 'Care Team');

            return (
              <View key={log.id} style={styles.logItem}>
                <View style={[styles.logIconBox, log.isRequest && { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons 
                    name={log.isRequest ? "calendar-outline" : "time"} 
                    size={16} 
                    color={log.isRequest ? "#3B82F6" : "#FF5B0A"} 
                  />
                </View>
                <View style={styles.logContent}>
                  <Text style={styles.logDesc} numberOfLines={1}>{log.description || 'Manual deduction'}</Text>
                  <Text style={styles.logMeta}>
                    {companionLabel} {log.ccType ? `· ${log.ccType.replace('_', ' ')}` : ''}
                  </Text>
                </View>
                <View style={styles.logRight}>
                  {log.isRequest ? (
                    <Text style={[
                      styles.logValue, 
                      { color: log.visitStatus === 'READ' ? '#10B981' : '#3B82F6', fontWeight: '800', fontSize: 11 }
                    ]}>
                      {log.visitStatus}
                    </Text>
                  ) : (
                    <Text style={styles.logValue}>
                      {isHours ? `${billMinutes ?? 60}m billed` : '−1 visit'}
                    </Text>
                  )}
                  <Text style={styles.logDate}>
                    {new Date(log.loggedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              </View>
            );

          })
        ) : (
          <Text style={styles.emptySubText}>No usage logged yet. Activity will appear once visits are completed.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginVertical: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  emptySubText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', paddingVertical: 12 },

  periodBanner: {
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  periodTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  periodTagText: {
    color: '#EA580C',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  periodRenewalText: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '600',
  },
  periodSubText: {
    color: '#7C2D12',
    fontSize: 12,
    lineHeight: 18,
  },
  rolloverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  rolloverBadgeText: {
    color: '#0284C7',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 20,
  },
  warningText: { color: '#B45309', fontWeight: '600', fontSize: 13, marginLeft: 8, flex: 1 },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#4A2B17', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginLeft: 8, flex: 1 },
  logCount: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },

  benefitCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardLow: { backgroundColor: '#FEFCE8', borderColor: '#FEF08A' },
  cardExhausted: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  cardSelected: { borderColor: '#FF5B0A', borderWidth: 2 },

  benefitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  benefitName: { fontSize: 15, fontWeight: '700', color: '#374151' },
  
  badgeExhausted: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTextExhausted: { color: '#EF4444', fontSize: 10, fontWeight: '800' },
  badgeLow: { backgroundColor: '#FEF9C3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTextLow: { color: '#D97706', fontSize: 10, fontWeight: '800' },
  badgeOk: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTextOk: { color: '#059669', fontSize: 10, fontWeight: '800' },

  progressContainer: { marginBottom: 10 },
  progressTrack: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  benefitFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  benefitStats: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  benefitUnit: { fontSize: 10, color: '#9CA3AF', fontWeight: '800', textTransform: 'uppercase' },

  carouselContainer: {
    marginBottom: 20,
  },
  carouselScroll: {
    paddingVertical: 6,
    gap: 12,
  },
  ringCard: {
    width: 96,
    alignItems: 'center',
  },
  ringCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    marginBottom: 8,
  },
  ringValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  ringSubValue: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  ringName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 14,
  },
  ringExhaustedBadge: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  ringSelectedBadge: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '800',
    color: '#EA580C',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    textTransform: 'uppercase',
  },

  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  logContent: { flex: 1, marginRight: 8 },
  logDesc: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  logMeta: { fontSize: 11, color: '#6B7280', fontWeight: '500', textTransform: 'uppercase' },
  logRight: { alignItems: 'flex-end' },
  logValue: { fontSize: 14, fontWeight: '800', color: '#374151' },
  logDate: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
});
