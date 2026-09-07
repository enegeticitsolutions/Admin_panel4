import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Clipboard,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '@/constants/api';
import { SathiBottomNav } from '@/components/shared/SathiBottomNav';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEEP_ORANGE = '#FE6700';
const PREMIUM_DARK = '#111827';
const SUCCESS_GREEN = '#10B981';

// Helper to cleanly format floating point credits (prevents 65.915447... and -0)
const formatPts = (val: any): string => {
  const n = Number(val || 0);
  if (isNaN(n) || Math.abs(n) < 0.001) return '0';
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
};

export default function SathiCreditsScreen() {
  useAndroidBackHandler();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'REDEEM' | 'HISTORY' | 'VOUCHERS'>('REDEEM');

  // Gift Card form state
  const [giftPoints, setGiftPoints] = useState('10');
  const [giftRecipient, setGiftRecipient] = useState('');

  // UPI form state
  const [upiPoints, setUpiPoints] = useState('10');
  const [upiId, setUpiId] = useState('');

  // Premium Success Modal state
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{ code?: string; points: number; valueRs: number; type: string; message?: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [copiedVoucherCode, setCopiedVoucherCode] = useState<string | null>(null);

  // Premium Confirm Modal state
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{ points: number; valueRs: number; type: 'GIFT_CARD' | 'UPI_TRANSFER'; details: any } | null>(null);

  // Premium Alert Modal state
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertModalData, setAlertModalData] = useState<{ title: string; message: string; isError?: boolean } | null>(null);

  const showAlert = (title: string, message: string, isError = true) => {
    setAlertModalData({ title, message, isError });
    setAlertModalVisible(true);
  };

  const handleCopyVoucher = (code: string) => {
    try {
      Clipboard.setString(code);
    } catch (e) {
      console.log('Clipboard error:', e);
    }
    setCopiedVoucherCode(code);
    setTimeout(() => {
      setCopiedVoucherCode((prev) => (prev === code ? null : prev));
    }, 5000);
  };

  const fetchCreditsSummary = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const res = await fetch(`${API_URL}/sathi/credits/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const summaryData = data.data || data;
        setSummary(summaryData);

        // Default credits to 10
        setGiftPoints('10');
        setUpiPoints('10');
      } else {
        throw new Error('Summary fetch failed');
      }
      setError(null);
    } catch (err) {
      console.log('Error fetching credits summary:', err);
      setError('Unable to load rewards. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCreditsSummary();
    }, [])
  );

  const handleRedeem = async (redeemType: 'GIFT_CARD' | 'UPI_TRANSFER') => {
    let pointsToRedeem = 0;
    let details: any = {};

    if (redeemType === 'GIFT_CARD') {
      const parsedGiftPts = parseInt(giftPoints || '0', 10);
      if (isNaN(parsedGiftPts) || parsedGiftPts <= 0) {
        showAlert('Invalid Amount', 'Please enter a valid number of credits to redeem.');
        return;
      }
      pointsToRedeem = parsedGiftPts;
      if (!giftRecipient.trim()) {
        showAlert('Required Field', 'Please enter your email or phone number to register this Gift Card.');
        return;
      }
      const conversionRate = summary?.conversionRate || 10;
      const valueRs = pointsToRedeem * conversionRate;
      details = {
        brand: 'MHN Gift Card',
        recipient: giftRecipient.trim(),
        optionId: null,
        title: `MHN Gift Card (₹${valueRs.toLocaleString('en-IN')})`,
      };
    } else if (redeemType === 'UPI_TRANSFER') {
      const parsedPoints = parseInt(upiPoints, 10);
      if (isNaN(parsedPoints) || parsedPoints <= 0) {
        showAlert('Invalid Amount', 'Please enter a valid number of credits to transfer.');
        return;
      }
      pointsToRedeem = parsedPoints;
      if (!upiId.trim() || !upiId.includes('@')) {
        showAlert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@upi).');
        return;
      }
      details = { upiId: upiId.trim() };
    }

    const available = Number(summary?.availableCredits || 0);
    if (available < pointsToRedeem) {
      showAlert(
        'Insufficient Credits',
        `You need ${pointsToRedeem} credits for this reward, but you only have ${formatPts(available)} credits available.`
      );
      return;
    }

    const conversionRate = summary?.conversionRate || 10;
    const valueRs = pointsToRedeem * conversionRate;

    setConfirmModalData({
      points: pointsToRedeem,
      valueRs,
      type: redeemType,
      details,
    });
    setConfirmModalVisible(true);
  };

  const processRedemption = async () => {
    if (!confirmModalData) return;
    setConfirmModalVisible(false);

    try {
      setRedeeming(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const res = await fetch(`${API_URL}/sathi/credits/redeem`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          points: confirmModalData.points,
          redeemType: confirmModalData.type,
          details: confirmModalData.details,
        }),
      });

      const resData = await res.json();
      if (res.ok || resData.success) {
        const generatedCode = resData.coupon?.code;
        if (generatedCode) {
          setSuccessModalData({
            code: generatedCode,
            points: confirmModalData.points,
            valueRs: confirmModalData.valueRs,
            type: 'GIFT_CARD',
          });
          setCodeCopied(false);
          setSuccessModalVisible(true);
        } else {
          setSuccessModalData({
            points: confirmModalData.points,
            valueRs: confirmModalData.valueRs,
            type: confirmModalData.type,
            message: resData.message || 'The transaction has been added to your reward history.',
          });
          setCodeCopied(false);
          setSuccessModalVisible(true);
        }
        setGiftRecipient('');
        setUpiId('');
      } else {
        showAlert('Redemption Failed', resData.message || 'Could not process redemption.');
      }
    } catch (err) {
      showAlert('Error', 'Network error while communicating with the server.');
    } finally {
      setRedeeming(false);
      setConfirmModalData(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={DEEP_ORANGE} />
        <Text style={styles.loaderText}>Loading Companion Rewards...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <MaterialCommunityIcons name="wifi-off" size={48} color="#D1D5DB" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#4B5563', textAlign: 'center', paddingHorizontal: 32 }}>
          {error}
        </Text>
        <TouchableOpacity 
          style={{ marginTop: 24, backgroundColor: DEEP_ORANGE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          onPress={() => { setLoading(true); fetchCreditsSummary(); }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const availablePoints = Number(summary?.availableCredits || 0);
  const conversionRate = summary?.conversionRate || 10;
  const rupeeValue = Math.round(availablePoints * conversionRate);
  const rewardOptions = summary?.rewardOptions || [
    { id: 'opt-1', title: 'MHN Gift Card ₹500', pointsRequired: 50, valueRs: 500 },
    { id: 'opt-2', title: 'MHN Gift Card ₹1,000', pointsRequired: 100, valueRs: 1000 },
    { id: 'opt-3', title: 'MHN Gift Card ₹1,500', pointsRequired: 150, valueRs: 1500 },
  ];
  const coupons = summary?.coupons || [];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Clean Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(sathi)/profile')}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Credits & Rewards</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Responsive Hero Balance Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBalanceBox}>
              <Text style={styles.heroLabel}>AVAILABLE CREDITS</Text>
              <View style={styles.pointsRow}>
                <Text style={styles.heroPointsText} numberOfLines={1} adjustsFontSizeToFit>
                  {formatPts(availablePoints)}
                </Text>
                <Text style={styles.heroPointsUnit}>pts</Text>
              </View>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroBottomRow}>
            <View style={styles.statColumn}>
              <Text style={styles.statColLabel}>Total Earned</Text>
              <Text style={[styles.statColValue, { color: '#34D399' }]} numberOfLines={1}>
                +{formatPts(summary?.totalEarned)} pts
              </Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statColLabel}>Total Redeemed</Text>
              <Text style={[styles.statColValue, { color: '#F87171' }]} numberOfLines={1}>
                {Number(summary?.totalRedeemed || 0) > 0 ? `-${formatPts(summary.totalRedeemed)}` : '0'} pts
              </Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statColLabel}>Exchange Rate</Text>
              <Text style={[styles.statColValue, { color: '#FBBF24' }]} numberOfLines={1}>
                1 pt = ₹{conversionRate}
              </Text>
            </View>
          </View>
        </View>

        {/* Responsive Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'REDEEM' && styles.tabButtonActive]}
            onPress={() => setActiveTab('REDEEM')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="gift"
              size={18}
              color={activeTab === 'REDEEM' ? '#FFFFFF' : '#4B5563'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'REDEEM' && styles.tabButtonTextActive, { fontSize: 11 }]}>
              Redeem
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'VOUCHERS' && styles.tabButtonActive]}
            onPress={() => setActiveTab('VOUCHERS')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="ticket"
              size={18}
              color={activeTab === 'VOUCHERS' ? '#FFFFFF' : '#4B5563'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'VOUCHERS' && styles.tabButtonTextActive, { fontSize: 11 }]}>
              Vouchers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'HISTORY' && styles.tabButtonActive]}
            onPress={() => setActiveTab('HISTORY')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="time"
              size={18}
              color={activeTab === 'HISTORY' ? '#FFFFFF' : '#4B5563'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'HISTORY' && styles.tabButtonTextActive, { fontSize: 11 }]}>
              History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content: REDEEM */}
        {activeTab === 'REDEEM' && (
          <View style={styles.tabContent}>


            {/* Option 1: Gift Card (MHN Gift Card Only - Stored in DB) */}
            <View style={styles.rewardCard}>
              <View style={styles.rewardHeader}>
                <View style={[styles.rewardIconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="gift" size={24} color="#EF4444" />
                </View>
                <View style={styles.rewardHeaderText}>
                  <Text style={styles.rewardTitle}>Gift Card</Text>
                  <Text style={styles.rewardDesc}>MHN Gift Card vouchers generated dynamically from database options</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Select Gift Card Brand:</Text>
              <View style={styles.pillsRow}>
                <View style={[styles.optionPill, styles.optionPillActive]}>
                  <Text style={[styles.optionPillText, styles.optionPillTextActive]}>
                    🎁 MHN Gift Card
                  </Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Enter Credits to Redeem:</Text>
              <TextInput
                style={styles.inputField}
                placeholder="10"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={giftPoints}
                onChangeText={setGiftPoints}
              />

              <Text style={styles.fieldLabel}>Recipient Email or Phone:</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. puneet@example.com or 9876543210"
                placeholderTextColor="#9CA3AF"
                value={giftRecipient}
                onChangeText={setGiftRecipient}
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.actionBtn, redeeming && { opacity: 0.7 }]}
                onPress={() => handleRedeem('GIFT_CARD')}
                disabled={redeeming}
                activeOpacity={0.8}
              >
                {redeeming ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionBtnText}>
                    Redeem {giftPoints || '0'} Credits
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Option 2: Direct UPI Transfer */}
            {/* Direct UPI Transfer — commented out for now
            <View style={styles.rewardCard}>
              <View style={styles.rewardHeader}>
                <View style={[styles.rewardIconBox, { backgroundColor: '#D1FAE5' }]}>
                  <MaterialCommunityIcons name="bank-transfer" size={26} color="#059669" />
                </View>
                <View style={styles.rewardHeaderText}>
                  <Text style={styles.rewardTitle}>Direct UPI Transfer</Text>
                  <Text style={styles.rewardDesc}>Transfer reward money directly to your UPI bank account</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Enter Credits to Redeem:</Text>
              <TextInput
                style={styles.inputField}
                placeholder="10"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={upiPoints}
                onChangeText={setUpiPoints}
              />


              <Text style={styles.fieldLabel}>Enter Your UPI ID:</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. yourname@okhdfcbank or 9876543210@upi"
                placeholderTextColor="#9CA3AF"
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#059669' }, redeeming && { opacity: 0.7 }]}
                onPress={() => handleRedeem('UPI_TRANSFER')}
                disabled={redeeming}
                activeOpacity={0.8}
              >
                {redeeming ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.actionBtnText}>
                    Transfer ₹{(parseInt(upiPoints || '0', 10) * conversionRate).toLocaleString('en-IN')} to UPI ({upiPoints || '0'} Credits)
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            */}
          </View>
        )}

        {/* Tab Content: VOUCHERS */}
        {activeTab === 'VOUCHERS' && (
          <View style={styles.tabContent}>
            {/* Section 1: Active & Claimed Gift Cards (With Copy Code support) */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.historySectionTitle}>Your MHN Gift Vouchers</Text>
              <Text style={styles.sectionBadgeText}>{coupons.length} Generated</Text>
            </View>

            {coupons.length > 0 ? (
              [...coupons].sort((a: any, b: any) => {
                if (a.status !== 'CLAIMED' && b.status === 'CLAIMED') return -1;
                if (a.status === 'CLAIMED' && b.status !== 'CLAIMED') return 1;
                return 0;
              }).map((coupon: any, index: number) => {
                const isClaimed = coupon.status === 'CLAIMED';
                return (
                  <View key={coupon.id || index} style={[styles.couponCard, isClaimed && styles.couponCardClaimed]}>
                    <View style={styles.couponTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.couponTitleText}>MHN Gift Card Voucher</Text>
                        <Text style={styles.couponCodeText}>{coupon.code}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: isClaimed ? '#F3F4F6' : '#D1FAE5' }]}>
                        <Text style={[styles.statusBadgeLabel, { color: isClaimed ? '#6B7280' : '#059669' }]}>
                          {isClaimed ? '🔘 CLAIMED' : '🟢 ACTIVE'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.couponDivider} />

                    <View style={styles.couponBottomRow}>
                      <View>
                        <Text style={styles.couponValueLabel}>Voucher Value</Text>
                        <Text style={styles.couponValueRs}>₹{coupon.valueRs || (coupon.pointsRedeemed * conversionRate)}</Text>
                      </View>

                      <View style={styles.couponActionButtons}>
                        <TouchableOpacity
                          style={[styles.copyBtn, copiedVoucherCode === coupon.code && { backgroundColor: '#D1FAE5', borderColor: '#10B981' }]}
                          onPress={() => handleCopyVoucher(coupon.code)}
                        >
                          <Ionicons
                            name={copiedVoucherCode === coupon.code ? "checkmark" : "copy-outline"}
                            size={14}
                            color={copiedVoucherCode === coupon.code ? "#059669" : "#4B5563"}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.copyBtnText, copiedVoucherCode === coupon.code && { color: '#059669', fontWeight: '700' }]}>
                            {copiedVoucherCode === coupon.code ? '✓ Copied!' : 'Copy Code'}
                          </Text>
                        </TouchableOpacity>

                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={[styles.emptyContainer, { marginBottom: 24 }]}>
                <Ionicons name="gift-outline" size={36} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No Gift Cards Generated Yet</Text>
                <Text style={styles.emptySubtitle}>
                  When you redeem credits for an MHN Gift Card, your unique voucher code and copy button will appear here!
                </Text>
              </View>
            )}

          </View>
        )}

        {/* Tab Content: HISTORY */}
        {activeTab === 'HISTORY' && (
          <View style={styles.tabContent}>
            <Text style={styles.historySectionTitle}>All Credit Ledger History</Text>
            {summary?.transactions && summary.transactions.length > 0 ? (
              summary.transactions.map((tx: any, index: number) => {
                const isEarned = tx.type === 'earned' || tx.pointsDelta > 0;
                return (
                  <View key={tx.id || index} style={styles.historyCard}>
                    <View
                      style={[
                        styles.historyIconCircle,
                        { backgroundColor: isEarned ? '#D1FAE5' : '#FEE2E2' },
                      ]}
                    >
                      <Ionicons
                        name={isEarned ? 'arrow-up-circle' : 'gift'}
                        size={24}
                        color={isEarned ? '#059669' : '#EF4444'}
                      />
                    </View>

                    <View style={styles.historyTextContainer}>
                      <Text style={styles.historyDesc} numberOfLines={2}>
                        {tx.description || (isEarned ? 'Companion Visit Earned' : 'Reward Redeemed')}
                      </Text>
                      <Text style={styles.historyDate}>
                        📅 {new Date(tx.createdAt || Date.now()).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <View style={styles.historyRightBox}>
                      <Text
                        style={[
                          styles.historyDelta,
                          { color: isEarned ? '#059669' : '#EF4444' },
                        ]}
                      >
                        {isEarned ? `+${formatPts(tx.pointsDelta)}` : `${formatPts(tx.pointsDelta)}`} pts
                      </Text>
                      <Text style={styles.historyRupee}>
                        ({isEarned ? '+' : '-'}₹{Math.round(Math.abs(Number(tx.pointsDelta) || 0) * conversionRate)})
                      </Text>
                      {tx.balanceAfter !== undefined && (
                        <Text style={styles.historyBal}>Bal: {formatPts(tx.balanceAfter)} pts</Text>
                      )}
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="history" size={50} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Your companion visits and credit redemptions will appear here as you log hours!
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Premium Custom Success Modal */}
      <Modal
        visible={successModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setSuccessModalVisible(false);
          fetchCreditsSummary();
          setActiveTab('HISTORY');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <Text style={styles.modalEmoji}>🎉</Text>
            </View>

            <Text style={styles.modalTitle}>
              {successModalData?.code ? 'Gift Voucher Generated!' : 'Redemption Successful!'}
            </Text>

            <Text style={styles.modalSubtitle}>
              You have successfully redeemed{' '}
              <Text style={{ fontWeight: '700', color: '#111827' }}>{successModalData?.points || 0} credits</Text>
              {' '}for a value of{' '}
              <Text style={{ fontWeight: '700', color: '#059669' }}>₹{successModalData?.valueRs || 0}</Text>.
            </Text>

            {successModalData?.code ? (
              <View style={styles.voucherBox}>
                <Text style={styles.voucherBoxLabel}>YOUR UNIQUE VOUCHER CODE</Text>
                <View style={styles.voucherCodeRow}>
                  <Text style={styles.voucherCodeText} selectable={true}>
                    {successModalData.code}
                  </Text>
                </View>
                <Text style={styles.voucherNote}>
                  Use this code at checkout when booking MHN health packages or consultations.
                </Text>
              </View>
            ) : (
              <View style={[styles.voucherBox, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}>
                <Text style={[styles.voucherNote, { textAlign: 'center', color: '#4B5563', fontSize: 13 }]}>
                  {successModalData?.message || 'Your transfer request has been initiated and recorded.'}
                </Text>
              </View>
            )}

            <View style={styles.modalActionsRow}>
              {successModalData?.code && (
                <TouchableOpacity
                  style={[styles.modalCopyBtn, codeCopied && { backgroundColor: '#059669' }]}
                  onPress={() => {
                    if (successModalData.code) {
                      try {
                        Clipboard.setString(successModalData.code);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 3000);
                      } catch (e) {
                        console.log('Clipboard error:', e);
                      }
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name={codeCopied ? "checkmark-circle" : "copy-outline"} size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.modalCopyBtnText}>
                    {codeCopied ? 'Code Copied to Clipboard!' : 'Copy Voucher Code'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => {
                  setSuccessModalVisible(false);
                  fetchCreditsSummary();
                  setActiveTab('HISTORY');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDoneBtnText}>Done & View in History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Premium Confirm Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconContainer, { backgroundColor: '#FFF7ED' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={32} color={DEEP_ORANGE} />
            </View>

            <Text style={styles.modalTitle}>Confirm Redemption</Text>

            <Text style={styles.modalSubtitle}>
              Redeem <Text style={{ fontWeight: '700', color: '#111827' }}>{confirmModalData?.points} credits</Text>
              {' '}(Worth <Text style={{ fontWeight: '700', color: '#059669' }}>₹{confirmModalData?.valueRs}</Text>) for{' '}
              {confirmModalData?.type === 'GIFT_CARD' ? 'MHN Gift Card' : 'Direct UPI Transfer'}?
            </Text>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.modalDoneBtn, { flex: 1, backgroundColor: '#F3F4F6' }]}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={[styles.modalDoneBtnText, { color: '#4B5563' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCopyBtn, { flex: 1, backgroundColor: DEEP_ORANGE }]}
                onPress={processRedemption}
              >
                <Text style={[styles.modalCopyBtnText, { color: '#FFFFFF' }]}>Redeem Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Premium Alert Modal */}
      <Modal
        visible={alertModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAlertModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconContainer, { backgroundColor: alertModalData?.isError ? '#FEF2F2' : '#EFF6FF' }]}>
              <MaterialCommunityIcons 
                name={alertModalData?.isError ? "alert-circle-outline" : "information-outline"} 
                size={32} 
                color={alertModalData?.isError ? "#EF4444" : "#3B82F6"} 
              />
            </View>

            <Text style={styles.modalTitle}>{alertModalData?.title}</Text>

            <Text style={styles.modalSubtitle}>
              {alertModalData?.message}
            </Text>

            <View style={{ width: '100%', marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.modalDoneBtn, { backgroundColor: alertModalData?.isError ? '#FEF2F2' : '#EFF6FF' }]}
                onPress={() => setAlertModalVisible(false)}
              >
                <Text style={[styles.modalDoneBtnText, { color: alertModalData?.isError ? '#EF4444' : '#3B82F6', fontWeight: '700' }]}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SathiBottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF3EB',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF3EB',
  },
  loaderText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAF3EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  heroCard: {
    backgroundColor: PREMIUM_DARK,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroBalanceBox: {
    flex: 1,
    minWidth: 160,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroPointsText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  heroPointsUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: DEEP_ORANGE,
    marginLeft: 6,
  },
  badgeContainer: {
    backgroundColor: 'rgba(254, 103, 0, 0.15)',
    borderWidth: 1,
    borderColor: DEEP_ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFB74D',
  },
  badgeSubText: {
    fontSize: 10,
    color: '#E5E7EB',
    marginTop: 2,
    fontWeight: '500',
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 16,
  },
  heroBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
  },
  statColLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  statColValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#374151',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: DEEP_ORANGE,
    shadowColor: DEEP_ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    borderRadius: 14,
    marginBottom: 18,
    alignItems: 'flex-start',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rewardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  rewardDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  optionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionPillActive: {
    backgroundColor: 'rgba(254, 103, 0, 0.1)',
    borderColor: DEEP_ORANGE,
  },
  optionPillText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  optionPillTextActive: {
    color: DEEP_ORANGE,
    fontWeight: '700',
  },
  inputField: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    marginBottom: 16,
  },
  rowFlex: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  staticValueBox: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    justifyContent: 'center',
  },
  staticValueText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  actionBtn: {
    backgroundColor: DEEP_ORANGE,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: DEEP_ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historySectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: DEEP_ORANGE,
  },
  couponCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  couponCardClaimed: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  couponTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  couponTitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  couponCodeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  couponDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  couponBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponValueLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  couponValueRs: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
  },
  couponActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  historyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  historyDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 18,
  },
  historyDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  historyRightBox: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  historyDelta: {
    fontSize: 15,
    fontWeight: '700',
  },
  historyRupee: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  historyBal: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalEmoji: {
    fontSize: 32,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  voucherBox: {
    width: '100%',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  voucherBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    letterSpacing: 1,
    marginBottom: 8,
  },
  voucherCodeRow: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  voucherCodeText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  voucherNote: {
    fontSize: 12,
    color: '#78350F',
    textAlign: 'center',
    lineHeight: 16,
  },
  modalActionsRow: {
    width: '100%',
    gap: 12,
  },
  modalCopyBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#EA580C',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalCopyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalDoneBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDoneBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
});
