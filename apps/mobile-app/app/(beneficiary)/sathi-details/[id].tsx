import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { ConnectContactButton } from '@/components/shared/ConnectContactModal';

export default function SathiDetailsScreen() {
  const { id, status } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userStr = await AsyncStorage.getItem('userData');
      if (!token || !userStr) return;
      
      const user = JSON.parse(userStr);
      const res = await fetch(`${API_URL}/beneficiary/sathi-requests/${user.id}/sathi/volunteers/${id}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log('[SathiDetails] API response:', JSON.stringify(data?.data?.phone));
      
      if (res.ok && (data.success || data.data)) {
        setProfile(data.data || data);
      }
    } catch (err) {
      console.error('Error fetching sathi profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectStatus = async (volunteerId: string, actionStatus: 'CONNECTED' | 'REJECTED') => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const userStr = await AsyncStorage.getItem('userData');
      if (!token || !userStr) return;
      const user = JSON.parse(userStr);

      const res = await fetch(`${API_URL}/beneficiary/sathi-requests/${user.id}/sathi/volunteers/${volunteerId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: actionStatus })
      });

      const data = await res.json();
      if (res.ok || data.success) {
        // Go back to the list
        router.back();
      } else {
        alert(data.message || 'Failed to update status.');
      }
    } catch (e: any) {
      alert(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.headerBar, { backgroundColor: '#FF6A00' }]}>
          <TouchableOpacity onPress={() => router.push('/(beneficiary)/sathi-request')} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#FFF" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Profile not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Use the safe area top inset for the orange header padding
  return (
    <View style={styles.container}>
      {/* Orange Header Background */}
      <View style={[styles.orangeHeaderBg, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.push('/(beneficiary)/sathi-request')} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#FFF" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.profileHeaderContent}>
          <Image 
            source={{ uri: sanitizeImageUri(profile.photo) }} 
            style={styles.avatar} 
          />
          <View style={styles.profileInfo}>
            <Text style={styles.nameText}>{profile.name}</Text>
            <Text style={styles.ageText}>{profile.age} years old</Text>
            
            <View style={styles.statsRow}>
              <View style={styles.ratingBadge}>
                <FontAwesome name="star" size={12} color="#FFF" />
                <Text style={styles.ratingText}>{profile.rating}</Text>
              </View>
              <Text style={styles.visitsText}>{profile.visits} visits completed</Text>
            </View>
            
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={14} color="#FFF" />
              <Text style={styles.locationText}>{profile.location}</Text>
            </View>
          </View>
        </View>
        
        {/* Header Action Buttons */}
        <View style={styles.headerActionsRow}>
          {status === 'PENDING' ? (
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity style={[styles.headerActionBtnWhite, { backgroundColor: '#2563EB', flex: 1, paddingHorizontal: 0 }]} onPress={() => handleConnectStatus(id as string, 'CONNECTED')}>
                <Feather name="user-check" size={18} color="#FFFFFF" />
                <Text style={[styles.headerActionBtnWhiteText, { color: '#FFFFFF' }]}>Connect</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerActionBtnWhite, { backgroundColor: '#EA580C', flex: 1, paddingHorizontal: 0 }]} onPress={() => handleConnectStatus(id as string, 'REJECTED')}>
                <Feather name="x" size={18} color="#FFFFFF" />
                <Text style={[styles.headerActionBtnWhiteText, { color: '#FFFFFF' }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity 
                style={styles.headerActionBtnWhite}
                onPress={() => router.push({ pathname: '/(beneficiary)/sathi-request', params: { sathiId: id } })}
              >
                <Feather name="calendar" size={18} color="#FF6A00" />
                <Text style={styles.headerActionBtnWhiteText}>Book Visit</Text>
              </TouchableOpacity>

              <ConnectContactButton
                name={profile.name}
                role="Sathi"
                phone={profile.phone || null}
                photo={profile.photo}
                trigger={
                  <View style={{ backgroundColor: '#FFF', width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="phone" size={20} color="#FF6A00" />
                  </View>
                }
              />
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* About Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.bioText}>{profile.bio}</Text>
          
          <View style={styles.checkmarksList}>
            <View style={styles.checkmarkItem}>
              <Feather name="check-circle" size={18} color="#10B981" />
              <Text style={styles.checkmarkText}>Background Verified</Text>
            </View>
            <View style={styles.checkmarkItem}>
              <Feather name="check-circle" size={18} color="#10B981" />
              <Text style={styles.checkmarkText}>Saathi Training Completed</Text>
            </View>
          </View>
        </View>

        {/* Availability Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Feather name="calendar" size={18} color="#FF6A00" />
            <Text style={[styles.cardTitle, { marginBottom: 0, marginLeft: 8 }]}>Availability</Text>
          </View>
          
          <View style={styles.availabilityPill}>
            <Text style={styles.availabilityPillText}>
              {profile.availability?.length > 0 ? profile.availability.join(', ') : 'Availability not selected'}
            </Text>
          </View>
        </View>

        {/* Languages Card */}
        {profile.languages && profile.languages.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons name="translate" size={18} color="#FF6A00" />
              <Text style={[styles.cardTitle, { marginBottom: 0, marginLeft: 8 }]}>Languages</Text>
            </View>
            <View style={styles.pillsContainer}>
              {profile.languages.map((lang: string, index: number) => (
                <View key={index} style={styles.languagePill}>
                  <Text style={styles.languagePillText}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Interests Card */}
        {profile.interests && profile.interests.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Feather name="heart" size={18} color="#FF6A00" />
              <Text style={[styles.cardTitle, { marginBottom: 0, marginLeft: 8 }]}>Interests & Activities</Text>
            </View>
            <View style={styles.pillsContainer}>
              {profile.interests.map((interest: string, index: number) => (
                <View key={index} style={styles.interestPill}>
                  <Text style={styles.interestPillText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reviews Card */}
        <View style={styles.card}>
          <View style={styles.reviewsHeaderRow}>
            <Text style={styles.cardTitle}>Reviews</Text>
            <View style={styles.ratingSummaryRow}>
              <FontAwesome name="star" size={16} color="#F59E0B" />
              <Text style={styles.ratingSummaryText}>{profile.rating}</Text>
              <Text style={styles.ratingSummaryCount}>({profile.reviewCount})</Text>
            </View>
          </View>
          
          {profile.reviews && profile.reviews.length > 0 ? (
            profile.reviews.map((rev: any, index: number) => (
              <View key={index} style={styles.reviewItem}>
                <View style={styles.reviewItemHeader}>
                  <Text style={styles.reviewAuthor}>Beneficiary</Text>
                  <View style={styles.reviewStars}>
                    {[...Array(5)].map((_, i) => (
                      <FontAwesome 
                        key={i} 
                        name="star" 
                        size={12} 
                        color={i < rev.rating ? "#F59E0B" : "#E5E7EB"} 
                        style={{ marginLeft: 2 }}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewDate}>Recently</Text>
                <Text style={styles.reviewText}>{rev.reviewText}</Text>
              </View>
            ))
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ color: '#6B7280', fontSize: 14 }}>No reviews yet</Text>
            </View>
          )}
        </View>
        
        {/* Extra padding for bottom spacing */}
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F3F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F3F6',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  orangeHeaderBg: {
    backgroundColor: '#FF6A00',
    paddingBottom: 24,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  profileHeaderContent: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#FFF',
    backgroundColor: '#FFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  ageText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  visitsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginLeft: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    marginLeft: 6,
  },
  headerActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  headerActionBtnWhite: {
    flex: 1,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  headerActionBtnWhiteText: {
    color: '#FF6A00',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 8,
  },
  headerActionBtnBlack: {
    flex: 1,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  headerActionBtnBlackText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 8,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 16,
  },
  checkmarksList: {
    gap: 12,
  },
  checkmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 14,
    color: '#10B981',
    marginLeft: 10,
    fontWeight: '500',
  },
  availabilityPill: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  availabilityPillText: {
    color: '#15803D',
    fontWeight: '600',
    fontSize: 15,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  durationBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  durationLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  durationValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  languagePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  languagePillText: {
    color: '#2563EB',
    fontWeight: '500',
    fontSize: 14,
  },
  interestPill: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  interestPillText: {
    color: '#9333EA',
    fontWeight: '500',
    fontSize: 14,
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingSummaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 6,
  },
  ratingSummaryCount: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  reviewItem: {
    marginBottom: 24,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewAuthor: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewDate: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 10,
  },
  reviewText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  callNowBtn: {
    flex: 1,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  callNowBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
  chatBtn: {
    flex: 1,
    backgroundColor: '#FF6A00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  chatBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  }
});
