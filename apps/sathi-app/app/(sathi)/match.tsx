import React, { useState, useCallback } from 'react';
import { Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const scale = (size: number) => Math.round((SCREEN_WIDTH / 390) * size);
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { API_URL } from '@/constants/api';
import { SathiBottomNav } from '@/components/shared/SathiBottomNav';
import { ConnectContactButton } from '@/components/shared/ConnectContactModal';
import { useExitOnBack } from '@/hooks/useExitOnBack';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

const DEEP_ORANGE = '#FE6700';

export default function SathiMatches() {
  useExitOnBack();
  useAndroidBackHandler();
  const { width } = useWindowDimensions();
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

  const handleRespondRequest = async (requestId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/sathi/visit-requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, rejectionReason: action === 'REJECT' ? 'Reschedule requested' : undefined }),
      });

      if (!response.ok) {
        throw new Error('Failed to respond');
      }

      Alert.alert('Success', action === 'ACCEPT' ? 'Visit request accepted!' : 'Visit request rescheduled/rejected.');
      fetchMatches(); // Refresh the list
    } catch (error) {
      console.error('Error responding to request:', error);
      Alert.alert('Error', 'Could not process your response.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={DEEP_ORANGE} />
        <Text style={styles.loaderText}>Finding visit requests...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="wifi-off" size={scale(64)} color="#D1D5DB" />
        <Text style={{ marginTop: scale(16), fontSize: scale(16), color: '#4B5563', textAlign: 'center', paddingHorizontal: scale(32) }}>
          {error}
        </Text>
        <TouchableOpacity 
          style={{ marginTop: scale(24), backgroundColor: DEEP_ORANGE, paddingHorizontal: scale(24), paddingVertical: scale(12), borderRadius: scale(8) }}
          onPress={() => { setLoading(true); fetchMatches(); }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: scale(16) }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Beneficiaries</Text>
          <Text style={styles.locationText}>Connect with seniors near you</Text>
        </View>

        {/* Tip Card */}
        <View style={styles.tipCard}>
          <Ionicons name="information-circle-outline" size={22} color="#FF6F00" style={styles.tipIcon} />
          <View style={styles.tipTextContent}>
            <Text style={styles.tipTitle}>How matching works:</Text>
            <Text style={styles.tipDesc}>
              Review nearby beneficiaries and connect with those whose needs align with your availability. Once matched, you'll receive their contact information to schedule your first visit.
            </Text>
          </View>
        </View>

        {/* Assigned Beneficiaries section */}
        <Text style={styles.sectionTitle}>Assigned Beneficiaries</Text>

        {matches.length > 0 ? (
          matches.map((item: any) => {
            const ben = item.beneficiary || item;
            const distance = ben.distance || '1.0 km';
            const totalVisits = item.totalVisits !== undefined ? item.totalVisits : 0;
            const lastVisit = item.lastVisit ? `Last: ${item.lastVisit}` : 'No prior visits';

            return (
              <View key={item.assignmentId || ben.id} style={styles.matchCard}>
                <View style={styles.seniorHeader}>
                  <Image source={{ uri: sanitizeImageUri(ben.photo, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150') }} style={styles.seniorPhoto} />
                  <View style={styles.seniorMeta}>
                    <Text style={styles.seniorName}>{ben.name}</Text>
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={14} color="#6B7280" />
                      <Text style={[styles.locationTextSmall, { flex: 1 }]} numberOfLines={1}>{ben.location || ben.address || 'Delhi'}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <View style={styles.distanceBadge}>
                        <Text style={styles.distanceText}>{distance}</Text>
                      </View>
                      <ConnectContactButton
                        name={ben.name}
                        role="Beneficiary"
                        phone={ben.phone || ben.user?.phone || ben.contactNumber || null}
                        photo={ben.photo}
                        trigger={
                          <View style={{ padding: 6, backgroundColor: '#FFF0E6', borderRadius: 20 }}>
                            <Ionicons name="call" size={18} color="#FF6A00" />
                          </View>
                        }
                      />
                  </View>
                </View>

                {/* Gap/Spacing */}
                <View style={{ height: 24 }} />

                {/* Bottom Row */}
                <View style={styles.actionsRow}>
                  <Text style={styles.statsText}>{totalVisits} total visits</Text>
                  <Text style={styles.statsText}>{lastVisit}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-search" size={60} color="#9CA3AF" />
            <Text style={styles.emptyText}>No matched beneficiaries assigned yet.</Text>
            <Text style={styles.emptySubText}>
              Your matched beneficiaries will appear here once allocated by operations staff.
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
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 100,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF0E6',
  },
  loaderText: {
    marginTop: 12,
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
  },
  header: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  locationText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 4,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF6F00',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  tipIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  tipTextContent: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(16),
  },
  statsText: {
    fontSize: scale(13),
    color: '#4B5563',
    fontFamily: 'Poppins-Medium',
  },
  seniorPhoto: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(12),
  },
  seniorMeta: {
    flex: 1,
    marginLeft: scale(14),
  },
  seniorName: {
    fontSize: scale(16),
    color: '#111827',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: scale(4),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationTextSmall: {
    fontSize: scale(13),
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    marginLeft: scale(4),
  },
  distanceBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: scale(12),
    alignSelf: 'flex-start',
  },
  distanceText: {
    fontSize: scale(12),
    color: '#4338CA',
    fontFamily: 'Poppins-Medium',
  },
  bioText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  tipDesc: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  seniorHeader: {
    flexDirection: 'row',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#9333EA',
    fontWeight: '600',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});
