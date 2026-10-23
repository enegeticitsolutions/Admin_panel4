import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { API_URL } from '@/constants/api';
import { NavigationService } from '@/utils/NavigationService';
import { SathiBottomNav } from '@/components/shared/SathiBottomNav';
import { ConnectContactButton } from '@/components/shared/ConnectContactModal';
import { useExitOnBack } from '@/hooks/useExitOnBack';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Bounded responsive scaling: stays proportional across small phones and large Pro Max screens
const scale = (size: number) => {
  const ratio = SCREEN_WIDTH / 390;
  const clamped = Math.min(Math.max(ratio, 0.85), 1.25);
  return Math.round(clamped * size);
};

const DEEP_ORANGE = '#FE6700';

export default function SathiMatches() {
  useExitOnBack();
  useAndroidBackHandler();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<any[]>([]);

  const fetchMatches = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/sathi/matches`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Matches data error');
      const data = await response.json();
      setMatches(data.data || data);
      setError(null);
    } catch (error) {
      console.log('Error fetching matches:', error);
      setError('Unable to load matches. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMatches();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={DEEP_ORANGE} />
        <Text style={styles.loaderText}>Loading beneficiaries...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="wifi-off" size={scale(56)} color="#D1D5DB" />
        <Text style={{ marginTop: scale(16), fontSize: scale(15), color: '#4B5563', textAlign: 'center', paddingHorizontal: scale(32), fontFamily: 'Poppins-Regular' }}>
          {error}
        </Text>
        <TouchableOpacity 
          style={styles.retryBtn}
          onPress={() => { setLoading(true); fetchMatches(); }}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + scale(95), scale(120)) }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Beneficiaries</Text>
          <Text style={styles.locationText}>Connect with seniors near you</Text>
        </View>

        {/* Tip / Guidance Card */}
        <View style={styles.tipCard}>
          <View style={styles.tipIconBadge}>
            <Ionicons name="information-circle" size={scale(20)} color="#EA580C" />
          </View>
          <View style={styles.tipTextContent}>
            <Text style={styles.tipTitle}>How matching works</Text>
            <Text style={styles.tipDesc}>
              Review your assigned beneficiaries, check their saved address, and use 1-tap navigation or call to schedule companion visits.
            </Text>
          </View>
        </View>

        {/* Section Header with Count */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Assigned Beneficiaries</Text>
          {matches.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{matches.length}</Text>
            </View>
          )}
        </View>

        {/* Beneficiary Cards List */}
        {matches.length > 0 ? (
          matches.map((item: any) => {
            const ben = item.beneficiary || item;
            const distance = ben.distance || '1.0 km';
            const totalVisits = item.totalVisits !== undefined ? item.totalVisits : 0;
            const lastVisit = item.lastVisit ? `Last: ${item.lastVisit}` : 'No prior visits';
            const displayAddress = ben.address || ben.location || [ben.city, ben.pincode].filter(Boolean).join(' - ') || 'Address not specified';

            return (
              <View key={item.assignmentId || ben.id} style={styles.matchCard}>
                {/* 1. Header Row: Avatar, Name, Age/Gender, Distance Badge */}
                <View style={styles.cardHeader}>
                  <Image
                    source={{ uri: sanitizeImageUri(ben.photo, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150') }}
                    style={styles.seniorPhoto}
                  />
                  <View style={styles.headerMeta}>
                    <View style={styles.nameAndDistanceRow}>
                      <Text style={styles.seniorName} numberOfLines={1}>
                        {ben.name}
                      </Text>
                      <View style={styles.distanceBadge}>
                        <Ionicons name="navigate-outline" size={scale(11)} color="#EA580C" style={{ marginRight: 3 }} />
                        <Text style={styles.distanceText}>{distance}</Text>
                      </View>
                    </View>

                    <Text style={styles.seniorSubText}>
                      {ben.age ? `${ben.age} yrs` : 'Senior'}
                      {ben.gender && ben.gender !== 'prefer_not_to_say' ? ` • ${ben.gender}` : ''}
                    </Text>
                  </View>
                </View>

                {/* 2. Full-Width Tappable Location Bar */}
                <TouchableOpacity
                  style={styles.locationBar}
                  activeOpacity={0.75}
                  onPress={() => NavigationService.instance.navigate({
                    address: displayAddress,
                    latitude: ben.latitude,
                    longitude: ben.longitude,
                    label: ben.name,
                    flatPlot: ben.flatPlot,
                    streetArea: ben.streetArea,
                    landmark: ben.landmark,
                    city: ben.city,
                    state: ben.state,
                    pincode: ben.pincode,
                  })}
                >
                  <View style={styles.locationIconBadge}>
                    <Ionicons name="location" size={scale(14)} color="#EA580C" />
                  </View>
                  <View style={{ flex: 1, marginRight: scale(6) }}>
                    <Text style={styles.locationLabel}>SAVED ADDRESS</Text>
                    <Text style={styles.addressText} numberOfLines={2}>
                      {displayAddress}
                    </Text>
                  </View>
                  <View style={styles.locationChevron}>
                    <Ionicons name="chevron-forward" size={scale(14)} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>

                {/* 3. Visits Statistics Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Ionicons name="calendar-outline" size={scale(13)} color="#6B7280" style={{ marginRight: 5 }} />
                    <Text style={styles.statText}>
                      <Text style={styles.statBold}>{totalVisits}</Text> {totalVisits === 1 ? 'visit' : 'total visits'}
                    </Text>
                  </View>
                  <View style={styles.statDot} />
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={scale(13)} color="#6B7280" style={{ marginRight: 5 }} />
                    <Text style={styles.statText}>{lastVisit}</Text>
                  </View>
                </View>

                {/* 4. Action Buttons Row: Dual Responsive 50/50 Buttons */}
                <View style={styles.actionBtnsRow}>
                  {/* Navigate Button */}
                  <TouchableOpacity
                    style={styles.navigateBtn}
                    activeOpacity={0.85}
                    onPress={() => NavigationService.instance.navigate({
                      address: displayAddress,
                      latitude: ben.latitude,
                      longitude: ben.longitude,
                      label: ben.name,
                      flatPlot: ben.flatPlot,
                      streetArea: ben.streetArea,
                      landmark: ben.landmark,
                      city: ben.city,
                      state: ben.state,
                      pincode: ben.pincode,
                    })}
                  >
                    <Ionicons name="navigate-circle-outline" size={scale(17)} color="#EA580C" style={{ marginRight: 6 }} />
                    <Text style={styles.navigateBtnText}>Navigate</Text>
                  </TouchableOpacity>

                  {/* Call Button via ConnectContactButton */}
                  <View style={{ flex: 1 }}>
                    <ConnectContactButton
                      name={ben.name}
                      role="Beneficiary"
                      phone={ben.phone || ben.user?.phone || ben.contactNumber || null}
                      photo={ben.photo}
                      trigger={
                        <View style={styles.callBtn}>
                          <Ionicons name="call-outline" size={scale(16)} color="#15803D" style={{ marginRight: 6 }} />
                          <Text style={styles.callBtnText}>Call</Text>
                        </View>
                      }
                    />
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="account-search-outline" size={scale(36)} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyText}>No matched beneficiaries assigned yet</Text>
            <Text style={styles.emptySubText}>
              Your matched senior companions will appear here once allocated by your operations coordinator.
            </Text>
          </View>
        )}
      </ScrollView>

      <SathiBottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF0E6',
  },
  scrollContent: {
    paddingHorizontal: scale(16),
    paddingTop: scale(20),
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF0E6',
  },
  loaderText: {
    marginTop: scale(12),
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
    fontSize: scale(14),
  },
  header: {
    marginBottom: scale(16),
  },
  welcomeText: {
    fontSize: scale(24),
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    color: '#111827',
  },
  locationText: {
    fontSize: scale(14),
    color: '#6B7280',
    marginTop: scale(2),
    fontFamily: 'Poppins-Regular',
  },
  // Tip Card
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: scale(16),
    padding: scale(14),
    marginBottom: scale(20),
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tipIconBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(10),
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  tipTextContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: scale(13.5),
    fontFamily: 'Poppins-SemiBold',
    color: '#9A3412',
    marginBottom: scale(2),
  },
  tipDesc: {
    fontSize: scale(12),
    color: '#4B5563',
    lineHeight: scale(18),
    fontFamily: 'Poppins-Regular',
  },
  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(14),
  },
  sectionTitle: {
    fontSize: scale(17),
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    color: '#111827',
  },
  countBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(10),
  },
  countBadgeText: {
    fontSize: scale(11.5),
    fontFamily: 'Poppins-SemiBold',
    color: '#EA580C',
  },
  // Beneficiary Card
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    padding: scale(16),
    marginBottom: scale(16),
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seniorPhoto: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(16),
    backgroundColor: '#F3F4F6',
  },
  headerMeta: {
    flex: 1,
    marginLeft: scale(12),
  },
  nameAndDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(8),
  },
  seniorName: {
    fontSize: scale(15.5),
    color: '#111827',
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    flex: 1,
  },
  seniorSubText: {
    fontSize: scale(12),
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    marginTop: scale(2),
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderRadius: scale(10),
  },
  distanceText: {
    fontSize: scale(11),
    color: '#EA580C',
    fontFamily: 'Poppins-Medium',
  },
  // Full-Width Location Bar
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: scale(14),
    paddingHorizontal: scale(10),
    paddingVertical: scale(9),
    marginTop: scale(12),
  },
  locationIconBadge: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(8),
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(10),
  },
  locationLabel: {
    fontSize: scale(9.5),
    color: '#9CA3AF',
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.6,
  },
  addressText: {
    fontSize: scale(12),
    color: '#1F2937',
    fontFamily: 'Poppins-Medium',
    marginTop: scale(1),
  },
  locationChevron: {
    paddingLeft: scale(4),
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: scale(12),
    marginTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: scale(12),
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
  },
  statBold: {
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
  },
  statDot: {
    width: scale(3),
    height: scale(3),
    borderRadius: scale(1.5),
    backgroundColor: '#D1D5DB',
  },
  // Action Buttons (50/50 Responsive)
  actionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginTop: scale(14),
  },
  navigateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#EA580C',
    borderRadius: scale(14),
    paddingVertical: scale(11),
  },
  navigateBtnText: {
    color: '#EA580C',
    fontFamily: 'Poppins-SemiBold',
    fontSize: scale(13),
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#16A34A',
    borderRadius: scale(14),
    paddingVertical: scale(11),
  },
  callBtnText: {
    color: '#16A34A',
    fontFamily: 'Poppins-SemiBold',
    fontSize: scale(13),
  },
  // Empty State
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    padding: scale(28),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: scale(8),
  },
  emptyIconCircle: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(14),
  },
  emptyText: {
    fontSize: scale(15),
    color: '#1F2937',
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
    marginBottom: scale(6),
  },
  emptySubText: {
    fontSize: scale(12.5),
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    lineHeight: scale(18),
  },
  retryBtn: {
    marginTop: scale(20),
    backgroundColor: DEEP_ORANGE,
    paddingHorizontal: scale(24),
    paddingVertical: scale(10),
    borderRadius: scale(12),
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: scale(14),
  },
});
