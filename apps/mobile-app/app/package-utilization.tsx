import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform, Modal, TextInput, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import PackageUtilizationPanel, { DetailedUtilization } from '@/components/shared/PackageUtilizationPanel';
import { AddonsSection } from '@/components/addons/AddonsSection';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { AddressPicker } from '@/components/ui/AddressPicker';
import { serviceabilityService } from '@/services/serviceability.service';
import { getAccurateLocation } from '@/services/location';
import RazorpayCheckout from 'react-native-razorpay';
import Constants from 'expo-constants';

const getRazorpayKey = (): string => {
  const fromExtra: string = (Constants.expoConfig?.extra?.razorpayKeyId as string) || '';
  const fromEnv: string = (process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID as string) || '';
  const clean = (s: string) => s.replace(/^["']|["']$/g, '').trim();
  return clean(fromExtra) || clean(fromEnv);
};

type SummaryData = {
  type: 'summary';
  beneficiaryId: string;
  beneficiaryName: string;
  age: number;
  activePackage: string | null;
  hasLowBalance: boolean;
  hasExhausted: boolean;
};

const formatUnitLabelText = (count: number, rawLabel?: string): string => {
  if (!rawLabel) return count === 1 ? '1 unit' : `${count} units`;
  let clean = rawLabel.trim().replace(/^per\s+/i, '');
  const lower = clean.toLowerCase();

  if (lower === 'visit') clean = count === 1 ? 'visit' : 'visits';
  else if (lower === 'hour' || lower === 'hr' || lower === 'hours' || lower === 'hrs') clean = count === 1 ? 'hour' : 'hours';
  else if (lower === 'session') clean = count === 1 ? 'session' : 'sessions';
  else if (lower === 'test') clean = count === 1 ? 'test' : 'tests';
  else if (lower === 'trip') clean = count === 1 ? 'trip' : 'trips';
  else if (lower === 'consult' || lower === 'consultation') clean = count === 1 ? 'consult' : 'consults';
  else if (lower === 'order') clean = count === 1 ? 'order' : 'orders';
  else if (lower === 'request') clean = count === 1 ? 'request' : 'requests';
  else if (lower === 'day') clean = count === 1 ? 'day' : 'days';
  else if (lower === 'month') clean = count === 1 ? 'month' : 'months';
  else {
    if (count !== 1 && !lower.endsWith('s')) {
      clean = clean + 's';
    }
  }

  return `${count} ${clean}`;
};

export default function PackageUtilizationScreen() {
  const router = useRouter();
    const safeBack = useSafeBack();
  const { beneficiaryId } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // The data could be a list of summaries (if subscriber without beneficiaryId),
  // or a detailed object (if beneficiary, or subscriber with specific beneficiaryId).
  const [summaryList, setSummaryList] = useState<SummaryData[] | null>(null);
  const [detailData, setDetailData] = useState<DetailedUtilization | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [selectedBenefit, setSelectedBenefit] = useState<any | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [preferredDate, setPreferredDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [preferredTiming, setPreferredTiming] = useState('Morning');
  const [additionalNote, setAdditionalNote] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // ── Add-on state ───────────────────────────────────────────────────────────
  const [availableAddons, setAvailableAddons] = useState<any[]>([]);
  const [selectedAddon, setSelectedAddon] = useState<any | null>(null);
  const [addonPreview, setAddonPreview] = useState<any | null>(null);
  const [addonQuantity, setAddonQuantity] = useState<number>(1);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [addonLoading, setAddonLoading] = useState(false);
  const [addonProcessing, setAddonProcessing] = useState(false);

  // ── Location state for Region-based Add-ons ──────────────────────────────
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [selectedPincode, setSelectedPincode] = useState<string>('');
  const [checkingLocation, setCheckingLocation] = useState<boolean>(false);
  const [mapModalVisible, setMapModalVisible] = useState<boolean>(false);

  const promptExhaustedMessage = (benefitName?: string) => {
    const msg = `Benefit ${benefitName ? `"${benefitName}" ` : ''}is exhausted. Please connect with support team to renew or upgrade your package.`;
    if (Platform.OS === 'web') {
      window.alert(`Benefit Exhausted\n\n${msg}`);
    } else {
      Alert.alert('Benefit Exhausted', msg);
    }
  };

  const handleSelectBenefit = (benefit: any) => {
    if (benefit.isExhausted || benefit.remainingUnits <= 0) {
      promptExhaustedMessage(benefit.benefitName);
      return;
    }
    setSelectedBenefit(benefit);
  };

  const handleRequestService = async () => {
    if (!selectedBenefit) return;
    if (selectedBenefit.isExhausted || selectedBenefit.remainingUnits <= 0) {
      promptExhaustedMessage(selectedBenefit.benefitName);
      setShowRequestModal(false);
      return;
    }
    if (!preferredDate) {
      if (Platform.OS === 'web') window.alert('Please enter a preferred date');
      else Alert.alert('Error', 'Please enter a preferred date');
      return;
    }

    setSubmittingRequest(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('No auth token found');

      const actualBenId = beneficiaryId || detailData?.beneficiaryId;
      if (!actualBenId) throw new Error('Beneficiary ID not found');

      const response = await fetch(`${API_URL}/shared/utilization/request-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          beneficiaryId: actualBenId,
          benefitId: selectedBenefit.benefitId,
          preferredDate,
          preferredTiming,
          additionalNote: userRole === 'subscriber' ? additionalNote : undefined
        })
      });

      const result = await response.json();
      if (result.success) {
        if (Platform.OS === 'web') {
          window.alert('✅ Request Submitted! We will schedule your service shortly.');
        } else {
          Alert.alert('✅ Request Submitted', 'We will schedule your service shortly.');
        }
        setShowRequestModal(false);
        setAdditionalNote('');
        setSelectedBenefit(null);
      } else {
        throw new Error(result.message || 'Failed to submit request');
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert('Error: ' + e.message);
      } else {
        Alert.alert('Error', e.message);
      }
    } finally {
      setSubmittingRequest(false);
    }
  };

  const fetchUtilization = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('No auth token found');

      let currentRole = userRole;
      const userDataStr = await AsyncStorage.getItem('userData');
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          currentRole = userData.role || null;
          setUserRole(currentRole);
        } catch (e) {}
      }

      let url = `${API_URL}/shared/utilization`;
      if (beneficiaryId) url += `?beneficiaryId=${beneficiaryId}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to load utilization data');
      }

      if (Array.isArray(data.data)) {
        // Enrich subscriber summaries with live database ledger balances
        const rawSummaries = data.data;
        const enrichedSummaries = await Promise.all(
          rawSummaries.map(async (item: SummaryData) => {
            if (item.beneficiaryId && !item.beneficiaryId.startsWith('unlinked-')) {
              try {
                const ledgerRes = await fetch(`${API_URL}/shared/utilization/ledger/${item.beneficiaryId}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const ledgerJson = await ledgerRes.json();
                if (ledgerJson.success && Array.isArray(ledgerJson.data?.balances) && ledgerJson.data.balances.length > 0) {
                  const balances = ledgerJson.data.balances;
                  const hasExhausted = balances.some((b: any) => {
                    const total = b.totalUnits ?? 0;
                    const used = b.usedUnits ?? 0;
                    const remaining = Math.max(0, total - used);
                    return total > 0 && (used >= total || remaining === 0 || (b.availableUnits !== undefined && b.availableUnits <= 0 && used > 0));
                  });
                  const hasLowBalance = balances.some((b: any) => {
                    const total = b.totalUnits ?? 0;
                    const used = b.usedUnits ?? 0;
                    const remaining = Math.max(0, total - used);
                    return total > 0 && !hasExhausted && remaining > 0 && (remaining / total) < 0.2;
                  });
                  return {
                    ...item,
                    hasExhausted,
                    hasLowBalance,
                  };
                }
              } catch (e) {
                // Fallback to original item
              }
            }
            return item;
          })
        );
        setSummaryList(enrichedSummaries);
        setDetailData(null);
      } else {
        const rawDetail: DetailedUtilization = data.data;
        const targetBeneficiaryId = rawDetail?.beneficiaryId || beneficiaryId;

        // Fetch live authoritative database ledger balances to guarantee 100% accurate data
        let authoritativeBenefits = rawDetail?.benefits || [];
        let authoritativeLogs = rawDetail?.recentLogs || [];

        if (targetBeneficiaryId && !String(targetBeneficiaryId).startsWith('unlinked-')) {
          try {
            const ledgerRes = await fetch(`${API_URL}/shared/utilization/ledger/${targetBeneficiaryId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const ledgerJson = await ledgerRes.json();

            if (ledgerJson.success && Array.isArray(ledgerJson.data?.balances) && ledgerJson.data.balances.length > 0) {
              const existingBenefitTypeMap = new Map<string, string | null>();
              (rawDetail?.benefits || []).forEach((b: any) => {
                if (b.benefitId) existingBenefitTypeMap.set(b.benefitId, b.benefitTypeName || null);
              });

              authoritativeBenefits = ledgerJson.data.balances.map((bal: any) => {
                const total = bal.totalUnits ?? 0;
                const used = bal.usedUnits ?? 0;
                const remaining = Math.max(0, total - used);
                const isExhausted = total > 0 && (used >= total || remaining === 0 || (bal.availableUnits !== undefined && bal.availableUnits <= 0 && used > 0));
                const isLowBalance = total > 0 && !isExhausted && (remaining / total) < 0.2;
                const usagePercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

                return {
                  benefitId: bal.benefitId,
                  benefitName: bal.benefitName || 'Benefit',
                  unitLabel: bal.unitLabel || 'units',
                  benefitTypeName: existingBenefitTypeMap.get(bal.benefitId) || null,
                  totalUnits: total,
                  usedUnits: used,
                  remainingUnits: remaining,
                  usagePercent,
                  isLowBalance,
                  isExhausted,
                };
              });

              // Merge transaction ledger entries if present
              if (Array.isArray(ledgerJson.data?.transactions) && ledgerJson.data.transactions.length > 0) {
                const txLogs = ledgerJson.data.transactions.map((tx: any) => ({
                  id: tx.id,
                  visitId: tx.reservationId || tx.id,
                  hoursConsumed: tx.units,
                  balanceBefore: tx.availableBefore,
                  balanceAfter: tx.availableAfter,
                  description: tx.reason || `${tx.transactionType}: ${tx.benefitName || 'Benefit'}`,
                  loggedAt: tx.createdAt,
                  careCompanionName: 'Care Team',
                  ccType: tx.unitLabel,
                  visitStatus: tx.transactionType,
                  actualMinutes: null,
                  isRequest: false
                }));

                const combined = [...authoritativeLogs, ...txLogs];
                const seenKeys = new Set<string>();
                authoritativeLogs = combined.filter((item: any) => {
                  const key = item.visitId || item.id;
                  if (seenKeys.has(key)) return false;
                  seenKeys.add(key);
                  return true;
                }).sort((a: any, b: any) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
              }
            }
          } catch (ledgerErr) {
            console.warn('[package-utilization] Ledger live sync fallback error:', ledgerErr);
          }
        }

        setDetailData({
          ...rawDetail,
          benefits: authoritativeBenefits,
          recentLogs: authoritativeLogs
        });
        setSummaryList(null);
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchAddons = async (regionId?: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      const targetRegion = regionId !== undefined ? regionId : selectedRegionId;
      const query = targetRegion ? `?regionId=${targetRegion}` : '';
      const res = await fetch(`${API_URL}/subscriber/subscriptions/addons/available${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setAvailableAddons(data.data || []);
    } catch (e) {
      // silently ignore — addons are optional
    }
  };

  const handleCheckLocation = async (lat?: number, lng?: number, pincode?: string) => {
    setCheckingLocation(true);
    try {
      const result = await serviceabilityService.checkLocation(lat, lng, pincode);
      if (result.isServiceable) {
        const regionId = result.region?.id || '';
        setSelectedAddress(result.location || `Pincode ${pincode || ''}`);
        if (pincode) setSelectedPincode(pincode);
        setSelectedRegionId(regionId);
        await fetchAddons(regionId);
      } else {
        setSelectedAddress(result.location || `Pincode ${pincode || ''}`);
        if (pincode) setSelectedPincode(pincode);
        setSelectedRegionId('');
        await fetchAddons('');
      }
    } catch (err) {
      console.error('Error checking location:', err);
      Alert.alert('Error', 'Could not check location serviceability.');
    } finally {
      setCheckingLocation(false);
    }
  };

  const handleDirectDetectLocation = async () => {
    setCheckingLocation(true);
    try {
      const loc = await getAccurateLocation();
      const resolvedAddress = loc.address || [loc.city, loc.state].filter(Boolean).join(', ') || 'Current Location';
      setSelectedAddress(resolvedAddress);
      if (loc.pincode) setSelectedPincode(loc.pincode);
      
      await handleCheckLocation(loc.latitude, loc.longitude, loc.pincode);
    } catch (err) {
      console.error('Direct detect location failed:', err);
      Alert.alert('Error', 'Failed to auto-detect your location.');
      setCheckingLocation(false);
    }
  };

  const handleSelectAddon = async (addon: any) => {
    if (!detailData?.subscription?.id) {
      Alert.alert('Error', 'No active subscription found.');
      return;
    }
    setSelectedAddon(addon);
    setAddonQuantity(1);
    setShowAddonModal(true);
    await fetchAddonPreview(addon.id, 1);
  };

  const fetchAddonPreview = async (benefitId: string, qty: number) => {
    if (!detailData?.subscription?.id) return;
    setAddonLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/subscriber/subscriptions/addon/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          subscriptionId: detailData.subscription.id,
          benefitId: benefitId,
          quantity: qty
        })
      });
      const data = await res.json();
      if (data.success) {
        setAddonPreview(data.data);
      } else {
        throw new Error(data.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load add-on pricing');
      setShowAddonModal(false);
    } finally {
      setAddonLoading(false);
    }
  };

  const handleQuantityChange = (delta: number) => {
    if (!selectedAddon) return;
    const newQty = Math.max(1, addonQuantity + delta);
    if (newQty === addonQuantity) return;
    setAddonQuantity(newQty);
    fetchAddonPreview(selectedAddon.id, newQty);
  };

  const handleAddonPayment = async () => {
    if (!selectedAddon || !addonPreview || !detailData?.subscription?.id) return;
    setAddonProcessing(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userDataStr = await AsyncStorage.getItem('userData');
      const user = userDataStr ? JSON.parse(userDataStr) : {};
      const razorpayKey = getRazorpayKey();

      // 1. Create Razorpay order
      const orderRes = await fetch(`${API_URL}/subscriber/subscriptions/addon/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          subscriptionId: detailData.subscription.id,
          benefitId: selectedAddon.id,
          quantity: addonQuantity
        })
      });
      const orderData = await orderRes.json();
      if (!orderData.success) throw new Error(orderData.message);

      const activeKey = orderData.data?.key_id || razorpayKey;

      const options = {
        description: `Add-on: ${addonPreview.benefitName}`,
        image: 'https://maihoonna.com/logo.png',
        currency: orderData.data.currency,
        key: activeKey,
        amount: orderData.data.amount,
        name: 'Mai-Hoonaa',
        order_id: orderData.data.order_id,
        prefill: {
          email: user.email || '',
          contact: user.phone || '',
          name: user.name || ''
        },
        theme: { color: '#FF5B0A' }
      };

      if (Platform.OS === 'web') {
        Alert.alert('Web Notice', 'Razorpay native checkout is not supported on web. Please complete checkout on the mobile app.');
        setAddonProcessing(false);
        return;
      }

      let paymentDetails: any;
      try {
        console.log('[Razorpay Add-on] Opening checkout with options:', JSON.stringify({
          key: options.key,
          amount: options.amount,
          order_id: options.order_id,
          currency: options.currency,
        }));

        const response = await RazorpayCheckout.open(options);
        paymentDetails = {
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature
        };
      } catch (payErr: any) {
        setAddonProcessing(false);
        const msg = payErr?.description || payErr?.message || '';
        if (payErr?.code === 0 || (typeof msg === 'string' && msg.toLowerCase().includes('cancel'))) {
          console.log('[Razorpay Add-on] Payment cancelled by user.');
          return;
        }
        console.error('[Razorpay Add-on Error]', payErr?.code, msg, payErr);
        Alert.alert('Payment Failed', (typeof msg === 'string' && msg) ? msg : 'Add-on payment failed. Please try again.');
        return;
      }

      // 2. Confirm purchase on backend
      const purchaseRes = await fetch(`${API_URL}/subscriber/subscriptions/addon/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          subscriptionId: detailData.subscription.id,
          benefitId: selectedAddon.id,
          quantity: addonQuantity,
          ...paymentDetails
        })
      });
      const purchaseData = await purchaseRes.json();
      if (!purchaseData.success) throw new Error(purchaseData.message);

      setShowAddonModal(false);
      setSelectedAddon(null);
      setAddonPreview(null);
      Alert.alert('✅ Add-on Activated!', purchaseData.message);
      // Refresh utilization so updated units appear
      await fetchUtilization();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Payment failed. Please try again.');
    } finally {
      setAddonProcessing(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchUtilization();
    }, [beneficiaryId])
  );

  useEffect(() => {
    fetchUtilization();
  }, [beneficiaryId]);

  // Fetch add-ons once when we land on a detail view (subscriber only)
  useEffect(() => {
    if (beneficiaryId && userRole === 'subscriber') {
      const initLocationAndAddons = async () => {
        try {
          const token = await AsyncStorage.getItem('userToken');
          if (token) {
            const profileRes = await fetch(`${API_URL}/subscriber/profile`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const profileJson = await profileRes.json();
            if (profileJson.success && profileJson.data?.user) {
              const u = profileJson.data.user;
              if (u.latitude && u.longitude) {
                await handleCheckLocation(u.latitude, u.longitude);
                return;
              } else if (u.pincode) {
                const svcRes = await fetch(`${API_URL}/public/zones/check-pincode?pincode=${u.pincode}`);
                const svcJson = await svcRes.json();
                if (svcJson.success && svcJson.data.available) {
                  const regId = svcJson.data.regionId || '';
                  setSelectedAddress(svcJson.data.location || `Pincode ${u.pincode}`);
                  setSelectedPincode(u.pincode);
                  setSelectedRegionId(regId);
                  await fetchAddons(regId);
                  return;
                }
              }
            }
          }
        } catch (e) {
          console.warn('Location init failed:', e);
        }
        fetchAddons('');
      };
      initLocationAndAddons();
    }
  }, [beneficiaryId, userRole]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => safeBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Package Utilization</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF5B0A" />
          <Text style={styles.loadingText}>Loading utilization data...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchUtilization}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchUtilization();
                setRefreshing(false);
              }}
              colors={['#FF5B0A']}
              tintColor="#FF5B0A"
            />
          }
        >
          {userRole !== 'beneficiary' && ((beneficiaryId && String(beneficiaryId).startsWith('unlinked-')) || (!beneficiaryId && detailData)) && (
            <TouchableOpacity 
              style={styles.addBeneficiaryCta}
              onPress={() => router.push({ pathname: '/(setup)/subscribe-form', params: { isLinkingFlow: 'true' } })}
            >
              <Ionicons name="person-add" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.addBeneficiaryCtaText}>Enroll your beneficiary to package</Text>
            </TouchableOpacity>
          )}

          {summaryList && summaryList.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Your Beneficiaries</Text>
              <Text style={styles.sectionSubtitle}>Select a beneficiary to view detailed usage</Text>
              
              {summaryList.map((item) => (
                <TouchableOpacity 
                  key={item.beneficiaryId} 
                  style={styles.summaryCard}
                  onPress={() => router.push({ pathname: '/package-utilization', params: { beneficiaryId: item.beneficiaryId } })}
                >
                  <View style={styles.summaryHeader}>
                    <View style={styles.summaryAvatar}>
                      <Text style={styles.summaryAvatarText}>{item.beneficiaryName.charAt(0)}</Text>
                    </View>
                    <View style={styles.summaryInfo}>
                      <Text style={styles.summaryName}>{item.beneficiaryName}</Text>
                      <Text style={styles.summaryMeta}>
                        {item.beneficiaryId.startsWith('unlinked-') 
                          ? `Unlinked Plan · ${item.activePackage || 'Care Plan'}` 
                          : `${item.age} years · ${item.activePackage || 'No Package'}`
                        }
                      </Text>
                    </View>
                  </View>
                  <View style={styles.summaryStatus}>
                    {item.beneficiaryId.startsWith('unlinked-') ? (
                      <View style={styles.statusBadgeUnassigned}><Text style={styles.statusBadgeTextUnassigned}>UNASSIGNED</Text></View>
                    ) : item.hasExhausted ? (
                      <View style={styles.statusBadgeExhausted}><Text style={styles.statusBadgeTextExhausted}>EXHAUSTED BENEFITS</Text></View>
                    ) : item.hasLowBalance ? (
                      <View style={styles.statusBadgeLow}><Text style={styles.statusBadgeTextLow}>LOW BALANCE</Text></View>
                    ) : (
                      <View style={styles.statusBadgeOk}><Text style={styles.statusBadgeTextOk}>ALL GOOD</Text></View>
                    )}
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {summaryList && summaryList.length === 0 && (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>No beneficiaries found.</Text>
            </View>
          )}

          {detailData && (
            <PackageUtilizationPanel 
              data={detailData} 
              selectedBenefitId={selectedBenefit?.benefitId}
              onSelectBenefit={handleSelectBenefit}
            />
          )}

          {/* ── Available Add-ons Component ── */}
          {detailData && userRole === 'subscriber' && (
            <AddonsSection
              addons={availableAddons}
              onSelectAddon={handleSelectAddon}
              formatUnitLabelText={formatUnitLabelText}
              showModal={showAddonModal}
              onCloseModal={() => {
                if (!addonProcessing) {
                  setShowAddonModal(false);
                  setAddonPreview(null);
                  setSelectedAddon(null);
                }
              }}
              addonPreview={addonPreview}
              addonQuantity={addonQuantity}
              addonLoading={addonLoading}
              addonProcessing={addonProcessing}
              onQuantityChange={handleQuantityChange}
              onPaymentSubmit={handleAddonPayment}
              beneficiaryName={detailData?.beneficiaryName || 'beneficiary'}
              selectedAddress={selectedAddress}
              selectedPincode={selectedPincode}
              selectedRegionId={selectedRegionId}
              checkingLocation={checkingLocation}
              onDetectLocation={handleDirectDetectLocation}
              onOpenMapPicker={() => setMapModalVisible(true)}
            />
          )}
        </ScrollView>
      )}

      {selectedBenefit && (
        <View style={styles.floatingActionContainer}>
          <View style={styles.selectedBenefitBanner}>
            <Text style={styles.selectedBenefitLabel} numberOfLines={1}>Selected: {selectedBenefit.benefitName}</Text>
            <TouchableOpacity onPress={() => setSelectedBenefit(null)} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={[
              styles.requestServiceBtn,
              (selectedBenefit.isExhausted || selectedBenefit.remainingUnits <= 0) && { backgroundColor: '#9CA3AF' }
            ]}
            onPress={() => {
              if (selectedBenefit.isExhausted || selectedBenefit.remainingUnits <= 0) {
                promptExhaustedMessage(selectedBenefit.benefitName);
                return;
              }
              setShowRequestModal(true);
            }}
          >
            <Ionicons name="calendar-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.requestServiceBtnText}>
              {(selectedBenefit.isExhausted || selectedBenefit.remainingUnits <= 0)
                ? 'BENEFIT EXHAUSTED — CONNECT WITH SUPPORT'
                : 'Request for the service'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Request Modal */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Service</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubTitle}>{selectedBenefit?.benefitName}</Text>
            
            {(selectedBenefit?.isExhausted || selectedBenefit?.remainingUnits <= 0) ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Ionicons name="alert-circle" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#DC2626', textAlign: 'center', marginBottom: 8 }}>
                  Benefit Exhausted
                </Text>
                <Text style={{ fontSize: 14, color: '#4B5563', textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
                  This benefit has no remaining units. Please connect with our support team to renew or upgrade your package.
                </Text>
                <TouchableOpacity 
                  style={{ backgroundColor: '#DC2626', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                  onPress={() => setShowRequestModal(false)}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                <View style={styles.modalForm}>
                  <Text style={styles.modalLabel}>Preferred Date *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9CA3AF"
                    value={preferredDate}
                    onChangeText={setPreferredDate}
                  />
                  <Text style={styles.modalHint}>Format: YYYY-MM-DD (e.g. 2026-07-15)</Text>

                  <Text style={styles.modalLabel}>Preferred Timing *</Text>
                  <View style={styles.timingRow}>
                    {['Morning', 'Afternoon', 'Evening'].map((slot) => {
                      const isActive = preferredTiming === slot;
                      return (
                        <TouchableOpacity
                          key={slot}
                          style={[styles.timingPill, isActive && styles.timingPillActive]}
                          onPress={() => setPreferredTiming(slot)}
                        >
                          <Text style={[styles.timingPillText, isActive && styles.timingPillTextActive]}>
                            {slot}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {userRole !== 'beneficiary' && (
                    <>
                      <Text style={styles.modalLabel}>Additional Note (Optional)</Text>
                      <TextInput
                        style={[styles.modalTextInput, styles.modalTextArea]}
                        placeholder="Provide any instructions or preferences..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={4}
                        value={additionalNote}
                        onChangeText={setAdditionalNote}
                      />
                    </>
                  )}

                  <TouchableOpacity 
                    style={styles.modalSubmitBtn}
                    onPress={handleRequestService}
                    disabled={submittingRequest}
                  >
                    {submittingRequest ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalSubmitBtnText}>Submit Request</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Address Picker Modal for Region-based Add-ons */}
      {mapModalVisible && (
        <Modal visible={mapModalVisible} animationType="slide" transparent={false}>
          <AddressPicker
            onAddressSelected={(selected) => {
              setMapModalVisible(false);
              handleCheckLocation(selected.latitude, selected.longitude);
            }}
            onCancel={() => setMapModalVisible(false)}
            title="Set Accurate Location"
            subtitle="Move the pin to detect location-specific add-on benefits"
          />
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF2E8' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    marginHorizontal: 16, 
    marginTop: 8, 
    backgroundColor: '#FF6900', 
    borderRadius: 20,
    gap: 12,
  },
  backBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 140 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 15, fontWeight: '500' },
  errorText: { marginTop: 12, color: '#EF4444', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: '#FF5B0A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  centerBox: { backgroundColor: '#FFFFFF', padding: 32, borderRadius: 16, alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: 15 },

  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F2E7DE',
    ...Platform.select({
      ios: { shadowColor: '#4A2B17', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 3 },
    }),
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  summaryAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  summaryAvatarText: { fontSize: 18, fontWeight: '800', color: '#EA580C' },
  summaryInfo: { flex: 1 },
  summaryName: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 4 },
  summaryMeta: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  summaryStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  
  statusBadgeExhausted: { backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeTextExhausted: { color: '#DC2626', fontSize: 11, fontWeight: '800' },
  statusBadgeLow: { backgroundColor: '#FEFCE8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeTextLow: { color: '#D97706', fontSize: 11, fontWeight: '800' },
  statusBadgeOk: { backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeTextOk: { color: '#16A34A', fontSize: 11, fontWeight: '800' },
  statusBadgeUnassigned: { backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeTextUnassigned: { color: '#EA580C', fontSize: 11, fontWeight: '800' },
  addBeneficiaryCta: {
    backgroundColor: '#FF5B0A',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#FF5B0A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  addBeneficiaryCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  floatingActionContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F2E7DE',
    ...Platform.select({
      ios: { shadowColor: '#4A2B17', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 4 },
      default: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6 },
    }),
    zIndex: 999,
  },
  selectedBenefitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  selectedBenefitLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    flex: 1,
  },
  requestServiceBtn: {
    backgroundColor: '#FF5B0A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestServiceBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    padding: 20,
    ...Platform.select({
      ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 15 },
      android: { elevation: 10 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF5B0A',
    marginTop: 12,
    marginBottom: 8,
  },
  modalForm: {
    marginTop: 10,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalHint: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  timingRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  timingPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  timingPillActive: {
    backgroundColor: '#FF5B0A',
    borderColor: '#FF5B0A',
  },
  timingPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  timingPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalSubmitBtn: {
    backgroundColor: '#FF5B0A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  // ── Add-on styles ───────────────────────────────────────────────────────────
  addonSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  addonSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addonSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  addonSectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 14,
    marginLeft: 2,
  },
  quantityContainer: {
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  quantityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  quantityDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValueText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#9A3412',
  },
  quantityUnitText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C2410C',
  },
  addonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#FDE8D8',
    ...Platform.select({
      ios: { shadowColor: '#FF5B0A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  addonCardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  addonCardType: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 2,
  },
  addonCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  addonCardDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  addonCardUnits: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    backgroundColor: '#D1FAE5',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  addonCardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  addonCardOriginalPrice: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  addonCardPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FF5B0A',
  },
  addonBuyBtn: {
    backgroundColor: '#FF5B0A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addonBuyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addonPricingBox: {
    backgroundColor: '#FFF7F3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE8D8',
  },
  addonPricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addonPricingLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  addonPricingValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  addonPricingStrike: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
});
