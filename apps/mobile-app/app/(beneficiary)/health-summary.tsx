import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '@/constants/api';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import {
  HealthSummaryData,
  downloadHealthSummaryPDF,
  shareHealthSummaryPDF,
  shareHealthSummaryText,
} from '@/services/HealthSummaryReportGenerator';
import { VitalsCharts } from '../(subscriber)/components/beneficiary/VitalsCharts';

export default function HealthSummaryScreen() {
  const { width } = useWindowDimensions();
  const MAX_CONTENT_WIDTH = 480;
  const responsiveStyle = { width: '100%' as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const };

  const router = useRouter();
  const safeBack = useSafeBack();
  useAndroidBackHandler();

  const params = useLocalSearchParams<{ beneficiaryId?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<'download' | 'share' | 'text' | null>(null);
  const [summaryData, setSummaryData] = useState<HealthSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trendTimeframe, setTrendTimeframe] = useState<'weekly' | 'monthly'>('weekly');
  const [readingFilter, setReadingFilter] = useState<number>(7);
  const [tableVitalFilter, setTableVitalFilter] = useState<string>('all');

  const availableVitalCodes = useMemo(() => {
    if (!summaryData?.allReadingsHistory) return [];
    const set = new Set<string>();
    summaryData.allReadingsHistory.forEach((r) => {
      if (r.vitalCode) set.add(r.vitalCode);
    });
    return Array.from(set);
  }, [summaryData?.allReadingsHistory]);

  const vitalNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (summaryData?.allReadingsHistory || []).forEach((r) => {
      if (r.vitalCode && !map[r.vitalCode]) {
        map[r.vitalCode] = r.vitalName;
      }
    });
    return map;
  }, [summaryData?.allReadingsHistory]);

  const displayedTrends = useMemo(() => {
    const baseTrends = summaryData?.vitalsTrends?.length
      ? summaryData.vitalsTrends
      : (summaryData?.monthlyTrends?.length ? summaryData.monthlyTrends : (summaryData?.weeklyTrends || []));

    return baseTrends
      .map((trend) => ({
        ...trend,
        v1: (trend.v1 || []).slice(-readingFilter),
        v2: trend.v2 ? trend.v2.slice(-readingFilter) : undefined,
      }))
      .filter((t) => (t.v1 && t.v1.length > 0) || (t.v2 && t.v2.length > 0));
  }, [summaryData, readingFilter]);

  const filteredTableReadings = useMemo(() => {
    if (!summaryData?.allReadingsHistory) return [];
    let list = summaryData.allReadingsHistory;
    if (tableVitalFilter !== 'all') {
      list = list.filter((r) => r.vitalCode === tableVitalFilter);
    }
    return list.slice(0, readingFilter);
  }, [summaryData?.allReadingsHistory, tableVitalFilter, readingFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      setError(null);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setError('Session expired. Please sign in again.');
        return;
      }

      // If beneficiaryId passed as query param (e.g. from subscriber view), call subscriber endpoint
      const endpoint = params.beneficiaryId
        ? `${API_URL}/subscriber/beneficiaries/${params.beneficiaryId}/health-summary`
        : `${API_URL}/beneficiary/health-summary`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();
      if (json.success && json.data) {
        setSummaryData(json.data);
      } else {
        setError(json.message || 'Unable to load health summary report.');
      }
    } catch (err: any) {
      console.error('Fetch Health Summary Error:', err);
      setError('Network connection error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.beneficiaryId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSummary();
  };

  const handleDownload = async () => {
    if (!summaryData) return;
    try {
      setActionLoading('download');
      await downloadHealthSummaryPDF(summaryData, readingFilter);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to download PDF');
    } finally {
      setActionLoading(null);
    }
  };

  const handleShare = async () => {
    if (!summaryData) return;
    try {
      setActionLoading('share');
      await shareHealthSummaryPDF(summaryData, readingFilter);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to share PDF');
    } finally {
      setActionLoading(null);
    }
  };

  const handleShareText = async () => {
    if (!summaryData) return;
    try {
      setActionLoading('text');
      await shareHealthSummaryText(summaryData);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to share text');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, responsiveStyle]}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health Summary</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={[styles.centerWrap, responsiveStyle]}>
          <ActivityIndicator size="large" color="#FE6700" />
          <Text style={styles.loadingText}>Compiling health summary report…</Text>
        </View>
      ) : error ? (
        <View style={[styles.centerWrap, responsiveStyle]}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSummary}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : summaryData ? (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[styles.content, responsiveStyle]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FE6700" />}
          >
            {/* Quick Action Bar */}
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, actionLoading === 'download' && styles.btnDisabled]}
                onPress={handleDownload}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'download' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="download" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.primaryActionBtnText}>Download PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryActionBtn, actionLoading === 'share' && styles.btnDisabled]}
                onPress={handleShare}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'share' ? (
                  <ActivityIndicator size="small" color="#FE6700" />
                ) : (
                  <>
                    <Feather name="share-2" size={17} color="#FE6700" style={{ marginRight: 6 }} />
                    <Text style={styles.secondaryActionBtnText}>Share PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.textActionBtn}
                onPress={handleShareText}
                disabled={actionLoading !== null}
              >
                <MaterialCommunityIcons name="whatsapp" size={18} color="#25D366" />
              </TouchableOpacity>
            </View>

            {/* Patient Demographics Card */}
            <View style={styles.demographicsCard}>
              <View style={styles.demographicsHeader}>
                <View>
                  <Text style={styles.patientName}>{summaryData.beneficiary.name}</Text>
                  <Text style={styles.patientMeta}>
                    {summaryData.beneficiary.age} yrs • {summaryData.beneficiary.gender}
                  </Text>
                </View>
                <View style={styles.bloodBadge}>
                  <Text style={styles.bloodBadgeLabel}>BLOOD</Text>
                  <Text style={styles.bloodBadgeValue}>{summaryData.beneficiary.bloodGroup}</Text>
                </View>
              </View>

              <View style={styles.demographicsDivider} />

              <View style={styles.demographicsDetails}>
                <View style={styles.detailRow}>
                  <Feather name="map-pin" size={14} color="#6B7280" style={{ marginRight: 6 }} />
                  <Text style={styles.detailText} numberOfLines={1}>
                    {summaryData.beneficiary.address || 'Address registered on file'}
                  </Text>
                </View>

                {summaryData.beneficiary.emergencyContacts.length > 0 && (
                  <View style={[styles.detailRow, { marginTop: 6 }]}>
                    <Feather name="phone-call" size={14} color="#EF4444" style={{ marginRight: 6 }} />
                    <Text style={styles.detailText}>
                      Emergency: {summaryData.beneficiary.emergencyContacts[0].name} (
                      {summaryData.beneficiary.emergencyContacts[0].relationship}) -{' '}
                      {summaryData.beneficiary.emergencyContacts[0].phone}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Critical Allergies Alert Banner */}
            {summaryData.allergies.length > 0 ? (
              <View style={styles.allergiesAlertCard}>
                <View style={styles.allergiesHeader}>
                  <Ionicons name="warning" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.allergiesTitle}>KNOWN ALLERGIES (SAFETY ALERT)</Text>
                </View>
                <View style={styles.allergiesWrap}>
                  {summaryData.allergies.map((allergy, i) => (
                    <View key={`allergy-item-${allergy}-${i}`} style={styles.allergyTag}>
                      <Text style={styles.allergyTagText}>{allergy}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.noAllergiesCard}>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" style={{ marginRight: 6 }} />
                <Text style={styles.noAllergiesText}>No known drug or food allergies reported (NKDA)</Text>
              </View>
            )}

            {/* Diagnosed Conditions */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Medical Conditions</Text>
            </View>
            <View style={styles.conditionsBox}>
              {summaryData.medicalConditions.length > 0 ? (
                summaryData.medicalConditions.map((cond, i) => (
                  <View key={`cond-item-${cond}-${i}`} style={styles.conditionTag}>
                    <Text style={styles.conditionTagText}>{cond}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyNoticeText}>No chronic medical conditions recorded.</Text>
              )}
            </View>

            {/* Latest Recorded Vitals */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Current Vitals</Text>
              <Text style={styles.sectionSub}>Latest Readings</Text>
            </View>

            {summaryData.vitals.length > 0 ? (
              <View style={styles.vitalsGrid}>
                {summaryData.vitals.map((v, i) => {
                  let statusBg = '#ECFDF5';
                  let statusColor = '#059669';
                  let statusText = 'Normal';
                  if (v.status === 'high') {
                    statusBg = '#FEF2F2';
                    statusColor = '#EF4444';
                    statusText = 'High';
                  } else if (v.status === 'low') {
                    statusBg = '#FFFBEB';
                    statusColor = '#D97706';
                    statusText = 'Low';
                  }

                  return (
                    <View key={`vital-item-${v.code || 'vital'}-${i}`} style={styles.vitalCard}>
                      <View style={styles.vitalTop}>
                        <Text style={styles.vitalName}>{v.name}</Text>
                        <View style={[styles.vitalStatusBadge, { backgroundColor: statusBg }]}>
                          <Text style={[styles.vitalStatusText, { color: statusColor }]}>{statusText}</Text>
                        </View>
                      </View>
                      <View style={styles.vitalMiddle}>
                        <Text style={styles.vitalValue}>{v.value}</Text>
                        <Text style={styles.vitalUnit}>{v.unit}</Text>
                      </View>
                      <View style={styles.vitalBottom}>
                        <Text style={styles.vitalNormalRange}>Range: {v.normalRange || 'N/A'}</Text>
                        <Text style={styles.vitalRecorder}>By {v.recorder}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyNoticeText}>No vitals recorded yet.</Text>
              </View>
            )}

            {/* Readings History Filter (Filter by Readings, not Days) */}
            <View style={styles.filterSectionCard}>
              <View style={styles.filterSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="sliders" size={15} color="#FE6700" style={{ marginRight: 6 }} />
                  <Text style={styles.filterSectionTitle}>Readings Filter</Text>
                </View>
                <View style={styles.filterSectionBadgeWrap}>
                  <Text style={styles.filterSectionBadge}>Last {readingFilter} Readings</Text>
                </View>
              </View>
              <Text style={styles.filterSectionSub}>
                Select how many past readings to plot in graphs & show in table:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                {[5, 7, 10, 15, 30].map((count) => {
                  const active = readingFilter === count;
                  return (
                    <TouchableOpacity
                      key={`filter-count-${count}`}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setReadingFilter(count)}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                        Last {count}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Vitals Trends & Graphs (Plotting Last N Readings) */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Vitals Trends & Graphs</Text>
                <Text style={styles.sectionSub}>Plotting last {readingFilter} readings per vital parameter</Text>
              </View>
            </View>

            <View style={styles.chartsContainer}>
              {displayedTrends.length > 0 ? (
                <VitalsCharts trends={displayedTrends} showHeader={false} />
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyNoticeText}>No trend readings available for this filter.</Text>
                </View>
              )}
            </View>

            {/* Detailed Readings Log Table */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Readings Data Table</Text>
                <Text style={styles.sectionSub}>Detailed showcase of last {readingFilter} readings</Text>
              </View>
            </View>

            {/* Vital Filter Tabs for Table */}
            {availableVitalCodes.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vitalTabsRow}>
                <TouchableOpacity
                  key="vital-tab-all"
                  style={[styles.vitalTabBtn, tableVitalFilter === 'all' && styles.vitalTabBtnActive]}
                  onPress={() => setTableVitalFilter('all')}
                >
                  <Text style={[styles.vitalTabBtnText, tableVitalFilter === 'all' && styles.vitalTabBtnTextActive]}>
                    All ({summaryData.allReadingsHistory?.length || 0})
                  </Text>
                </TouchableOpacity>
                {availableVitalCodes.map((code) => {
                  const vitalName = vitalNameMap[code] || code;
                  const count = (summaryData.allReadingsHistory || []).filter((r) => r.vitalCode === code).length;
                  const active = tableVitalFilter === code;
                  return (
                    <TouchableOpacity
                      key={`vital-tab-${code}`}
                      style={[styles.vitalTabBtn, active && styles.vitalTabBtnActive]}
                      onPress={() => setTableVitalFilter(code)}
                    >
                      <Text style={[styles.vitalTabBtnText, active && styles.vitalTabBtnTextActive]}>
                        {vitalName} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Table Content Card */}
            <View style={styles.tableCard}>
              {filteredTableReadings.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View style={{ minWidth: 420 }}>
                    {/* Table Header */}
                    <View style={styles.tableHeadRow}>
                      <Text style={[styles.tableHeadCell, { width: 110 }]}>Date & Time</Text>
                      <Text style={[styles.tableHeadCell, { width: 125 }]}>Vital Parameter</Text>
                      <Text style={[styles.tableHeadCell, { width: 85 }]}>Reading</Text>
                      <Text style={[styles.tableHeadCell, { width: 75 }]}>Status</Text>
                      <Text style={[styles.tableHeadCell, { width: 85, textAlign: 'right' }]}>Recorded By</Text>
                    </View>

                    {/* Table Body Rows */}
                    {filteredTableReadings.map((r, idx) => {
                      let statusBg = '#ECFDF5';
                      let statusColor = '#059669';
                      let statusText = 'Normal';
                      if (r.status === 'high') {
                        statusBg = '#FEF2F2';
                        statusColor = '#EF4444';
                        statusText = 'High';
                      } else if (r.status === 'low') {
                        statusBg = '#FFFBEB';
                        statusColor = '#D97706';
                        statusText = 'Low';
                      } else if (r.status === 'abnormal') {
                        statusBg = '#FEF2F2';
                        statusColor = '#DC2626';
                        statusText = 'Abnormal';
                      }

                      return (
                        <View
                          key={`table-row-${r.id || idx}-${idx}`}
                          style={[styles.tableBodyRow, idx % 2 === 1 && styles.tableBodyRowAlt]}
                        >
                          <View style={{ width: 110 }}>
                            <Text style={styles.tableCellDate}>{r.displayDate}</Text>
                            <Text style={styles.tableCellTime}>{r.displayTime}</Text>
                          </View>
                          <Text style={[styles.tableCellText, { width: 125, fontFamily: 'Poppins-Medium' }]} numberOfLines={2}>
                            {r.vitalName}
                          </Text>
                          <View style={{ width: 85 }}>
                            <Text style={[styles.tableCellText, { fontFamily: 'Poppins-Bold', color: '#111827' }]}>
                              {r.value}
                            </Text>
                            {r.unit ? <Text style={styles.tableCellSub}>{r.unit}</Text> : null}
                          </View>
                          <View style={{ width: 75 }}>
                            <View style={[styles.tableStatusBadge, { backgroundColor: statusBg }]}>
                              <Text style={[styles.tableStatusText, { color: statusColor }]}>{statusText}</Text>
                            </View>
                          </View>
                          <Text style={[styles.tableCellSub, { width: 85, textAlign: 'right' }]} numberOfLines={1}>
                            {r.recorder}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              ) : (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={styles.emptyNoticeText}>No reading records matching this filter.</Text>
                </View>
              )}
            </View>

            {/* Monthly Report Section */}
            {summaryData.monthlyReport && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Monthly Health Report</Text>
                  <Text style={styles.sectionSub}>Past 30 Days</Text>
                </View>

                <View style={styles.monthlyReportCard}>
                  <View style={styles.monthlyReportHeader}>
                    <Feather name="calendar" size={16} color="#FE6700" style={{ marginRight: 6 }} />
                    <Text style={styles.monthlyReportPeriod}>{summaryData.monthlyReport.periodLabel}</Text>
                  </View>

                  <View style={styles.monthlyGrid}>
                    <View style={styles.monthlyMetric}>
                      <Text style={styles.monthlyMetricVal}>{summaryData.monthlyReport.totalVisits}</Text>
                      <Text style={styles.monthlyMetricLbl}>Visits Completed</Text>
                    </View>
                    <View style={styles.monthlyMetric}>
                      <Text style={[styles.monthlyMetricVal, { color: '#10B981' }]}>
                        {summaryData.monthlyReport.adherencePercentage}%
                      </Text>
                      <Text style={styles.monthlyMetricLbl}>Adherence</Text>
                    </View>
                    <View style={styles.monthlyMetric}>
                      <Text style={styles.monthlyMetricVal}>{summaryData.monthlyReport.takenCount}</Text>
                      <Text style={styles.monthlyMetricLbl}>Doses Logged</Text>
                    </View>
                    <View style={styles.monthlyMetric}>
                      <View style={styles.statusBadgeSmall}>
                        <Text style={styles.statusBadgeSmallText}>
                          {summaryData.monthlyReport.overallStatus.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.monthlyMetricLbl}>Status</Text>
                    </View>
                  </View>

                  {/* Monthly Vitals Stat Rows */}
                  {summaryData.monthlyReport.vitalsStats.length > 0 && (
                    <View style={styles.monthlyStatsTable}>
                      <View style={styles.monthlyTableHeader}>
                        <Text style={[styles.monthlyTableCol, { flex: 2 }]}>Parameter</Text>
                        <Text style={styles.monthlyTableCol}>Min</Text>
                        <Text style={styles.monthlyTableCol}>Max</Text>
                        <Text style={styles.monthlyTableCol}>Avg</Text>
                        <Text style={[styles.monthlyTableCol, { textAlign: 'right' }]}>Latest</Text>
                      </View>
                      {summaryData.monthlyReport.vitalsStats.map((stat, idx) => (
                        <View key={`stat-row-${stat.code}-${idx}`} style={styles.monthlyTableRow}>
                          <Text style={[styles.monthlyTableCell, { flex: 2, fontFamily: 'Poppins-Medium' }]}>
                            {stat.name}
                          </Text>
                          <Text style={[styles.monthlyTableCell, { color: '#10B981' }]}>{stat.min}</Text>
                          <Text style={[styles.monthlyTableCell, { color: '#EF4444' }]}>{stat.max}</Text>
                          <Text style={[styles.monthlyTableCell, { fontFamily: 'Poppins-Bold' }]}>{stat.avg}</Text>
                          <Text style={[styles.monthlyTableCell, { textAlign: 'right', color: '#FE6700', fontFamily: 'Poppins-Bold' }]}>
                            {stat.latest}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Prescribed Medications & Schedule */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Medications</Text>
              <Text style={styles.sectionSub}>{summaryData.medications.length} Prescribed</Text>
            </View>

            {summaryData.medications.length > 0 ? (
              summaryData.medications.map((m, i) => (
                <View key={`med-item-${m.id || m.name}-${i}`} style={styles.medicationCard}>
                  <View style={styles.medicationTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.medicationName}>{m.name}</Text>
                      {m.prescribedBy ? (
                        <Text style={styles.medicationPrescriber}>Dr. {m.prescribedBy}</Text>
                      ) : null}
                    </View>
                    <View style={styles.medicationDosageBadge}>
                      <Text style={styles.medicationDosageText}>{m.dosage}</Text>
                    </View>
                  </View>
                  <View style={styles.medicationBottom}>
                    <Text style={styles.medicationSchedule}>
                      🕒 {m.timeSlots.length > 0 ? m.timeSlots.join(', ') : m.frequency}
                    </Text>
                    {m.instructions ? (
                      <Text style={styles.medicationInstructions}>💡 {m.instructions}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyNoticeText}>No active medications prescribed.</Text>
              </View>
            )}

            {/* 30-Day Medication Adherence Card */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Medication Adherence</Text>
              <Text style={styles.sectionSub}>Past 30 Days</Text>
            </View>

            <View style={styles.adherenceCard}>
              <View style={styles.adherenceTop}>
                <View>
                  <Text style={styles.adherencePercent}>{summaryData.adherence.percentage}%</Text>
                  <Text style={styles.adherencePercentLabel}>Overall Compliance</Text>
                </View>
                <View style={styles.adherenceStatusPill}>
                  <Text style={styles.adherenceStatusText}>
                    {summaryData.adherence.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.adherenceDivider} />

              <View style={styles.adherenceStatsGrid}>
                <View style={styles.adherenceStatItem}>
                  <Text style={[styles.adherenceStatValue, { color: '#16A34A' }]}>
                    {summaryData.adherence.takenCount}
                  </Text>
                  <Text style={styles.adherenceStatLabel}>Taken</Text>
                </View>
                <View style={styles.adherenceStatItem}>
                  <Text style={[styles.adherenceStatValue, { color: '#EF4444' }]}>
                    {summaryData.adherence.missedCount}
                  </Text>
                  <Text style={styles.adherenceStatLabel}>Missed</Text>
                </View>
                <View style={styles.adherenceStatItem}>
                  <Text style={styles.adherenceStatValue}>{summaryData.adherence.totalScheduled}</Text>
                  <Text style={styles.adherenceStatLabel}>Scheduled</Text>
                </View>
              </View>
            </View>

            {/* Care Overview & Companion */}
            {summaryData.careOverview.assignedCompanionName ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Care Companion Overview</Text>
                </View>
                <View style={styles.careCard}>
                  <Text style={styles.careCompanionName}>
                    Assigned: {summaryData.careOverview.assignedCompanionName}
                  </Text>
                  {summaryData.careOverview.lastVisitDate ? (
                    <Text style={styles.careVisitMeta}>
                      Last Visit: {summaryData.careOverview.lastVisitDate} • Mood: {summaryData.careOverview.lastVisitMood || 'Good'}
                    </Text>
                  ) : null}
                  {summaryData.careOverview.notes ? (
                    <Text style={styles.careNotes}>"{summaryData.careOverview.notes}"</Text>
                  ) : null}
                </View>
              </>
            ) : null}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#6B7280',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FE6700',
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  primaryActionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#FE6700',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FE6700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
  },
  secondaryActionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFF0E6',
    borderWidth: 1.5,
    borderColor: '#FE6700',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    color: '#FE6700',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
  },
  textActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  demographicsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  demographicsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientName: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
  },
  patientMeta: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  bloodBadge: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  bloodBadgeLabel: {
    fontSize: 9,
    fontFamily: 'Poppins-Bold',
    color: '#991B1B',
  },
  bloodBadgeValue: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    color: '#DC2626',
  },
  demographicsDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  demographicsDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#4B5563',
    flex: 1,
  },
  allergiesAlertCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#F87171',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  allergiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  allergiesTitle: {
    fontSize: 12,
    fontFamily: 'Poppins-Bold',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  allergiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergyTag: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  allergyTagText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: '#991B1B',
  },
  noAllergiesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noAllergiesText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: '#166534',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#6B7280',
  },
  conditionsBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  conditionTag: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  conditionTagText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: '#C2410C',
  },
  vitalsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  vitalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vitalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vitalName: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#374151',
  },
  vitalStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  vitalStatusText: {
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
  },
  vitalMiddle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 4,
  },
  vitalValue: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    color: '#FE6700',
  },
  vitalUnit: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
  },
  vitalBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  vitalNormalRange: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
  },
  vitalRecorder: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#9CA3AF',
  },
  filterSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
  },
  filterSectionBadgeWrap: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  filterSectionBadge: {
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
    color: '#FE6700',
  },
  filterSectionSub: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    marginBottom: 10,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#FE6700',
    borderColor: '#FE6700',
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-Bold',
  },
  vitalTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    paddingVertical: 2,
  },
  vitalTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  vitalTabBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  vitalTabBtnText: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
    color: '#6B7280',
  },
  vitalTabBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-Bold',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    overflow: 'hidden',
  },
  tableHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeadCell: {
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  tableBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableBodyRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  tableCellDate: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
    color: '#111827',
  },
  tableCellTime: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    color: '#9CA3AF',
  },
  tableCellText: {
    fontSize: 12,
    color: '#374151',
  },
  tableCellSub: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
  },
  tableStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tableStatusText: {
    fontSize: 10,
    fontFamily: 'Poppins-Bold',
  },
  timeframeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 2,
  },
  timeframeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeframeBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  timeframeBtnText: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
    color: '#6B7280',
  },
  timeframeBtnTextActive: {
    color: '#FE6700',
    fontFamily: 'Poppins-Bold',
  },
  chartsContainer: {
    marginBottom: 16,
  },
  monthlyReportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  monthlyReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthlyReportPeriod: {
    fontSize: 13,
    fontFamily: 'Poppins-Bold',
    color: '#9A3412',
  },
  monthlyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  monthlyMetric: {
    alignItems: 'center',
    flex: 1,
  },
  monthlyMetricVal: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
  },
  monthlyMetricLbl: {
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
    color: '#78350F',
    marginTop: 2,
  },
  statusBadgeSmall: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeSmallText: {
    fontSize: 9,
    fontFamily: 'Poppins-Bold',
    color: '#059669',
  },
  monthlyStatsTable: {
    marginTop: 4,
  },
  monthlyTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 6,
    marginBottom: 6,
  },
  monthlyTableCol: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  monthlyTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  monthlyTableCell: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#374151',
  },
  medicationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  medicationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  medicationName: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
  },
  medicationPrescriber: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    marginTop: 1,
  },
  medicationDosageBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  medicationDosageText: {
    fontSize: 12,
    fontFamily: 'Poppins-Bold',
    color: '#374151',
  },
  medicationBottom: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 4,
  },
  medicationSchedule: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#4B5563',
  },
  medicationInstructions: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
  },
  adherenceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  adherenceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adherencePercent: {
    fontSize: 26,
    fontFamily: 'Poppins-Bold',
    color: '#10B981',
  },
  adherencePercentLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
  },
  adherenceStatusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  adherenceStatusText: {
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
    color: '#059669',
  },
  adherenceDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  adherenceStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  adherenceStatItem: {
    alignItems: 'center',
  },
  adherenceStatValue: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
  },
  adherenceStatLabel: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  careCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  careCompanionName: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
  },
  careVisitMeta: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  careNotes: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    fontStyle: 'italic',
    color: '#4B5563',
    marginTop: 6,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  emptyNoticeText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#9CA3AF',
  },
});
