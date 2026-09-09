import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '@/constants/api';
import { SathiBottomNav } from '@/components/shared/SathiBottomNav';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { sanitizeImageUri } from '@/utils/sanitizeImageUri';
import { deleteSathiAccount } from '@/utils/deleteAccount';
import CareSupportModal from '@/components/shared/CareSupportModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => Math.round((SCREEN_WIDTH / 390) * size);

const DEEP_ORANGE = '#FE6700';

export default function SathiProfile() {
  const router = useRouter();
  const { logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [reviewsModalVisible, setReviewsModalVisible] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [fetchingReviews, setFetchingReviews] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/sathi/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Profile fetch error');
      const data = await response.json();
      setProfile(data.data || data);
    } catch (error) {
      console.log('Error fetching profile:', error);
      Alert.alert('Error', 'Could not load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setFetchingReviews(true);
      setReviewsModalVisible(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/sathi/profile/reviews`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Reviews fetch error');
      const data = await response.json();
      setReviews(data.data || []);
    } catch (error) {
      console.log('Error fetching reviews:', error);
      Alert.alert('Error', 'Could not load reviews.');
    } finally {
      setFetchingReviews(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      handleUploadPhoto(result.assets[0].uri);
    }
  };

  const handleUploadPhoto = async (uri: string) => {
    try {
      setUploading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      const formData = new FormData();
      formData.append('file', { uri, name: filename, type } as any);
      formData.append('targetType', 'self');

      const response = await fetch(`${API_URL}/profile-photo/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setProfile((prev: any) => ({ ...prev, profilePhoto: data.url }));
        Alert.alert('Success', 'Profile photo updated!');
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload Error:', error);
      Alert.alert('Error', error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    await logout();
    router.replace('/(auth)');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account?\n\nThis action will deactivate your profile and you will no longer be able to log in. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            const success = await deleteSathiAccount();
            if (success) {
              Alert.alert(
                'Account Deleted',
                'Your account has been deleted successfully.\n\nTo reactivate in the future, please contact the Saathi coordinator on aastha@maihoonna.com',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      await logout();
                      router.replace('/(auth)');
                    },
                  },
                ]
              );
            } else {
              Alert.alert('Error', 'Failed to delete account. Please try again later.');
            }
          }
        }
      ]
    );
  };

  const handleOpenSupport = () => {
    setSupportModalVisible(true);
  };

  if (loading && !profile) {
    return (
      <View style={[styles.container, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 40 : 20) }]}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={DEEP_ORANGE} />
          <Text style={styles.loaderText}>Loading Profile...</Text>
        </View>
        <SathiBottomNav />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Orange Background Top Half */}
      <View style={[styles.orangeHeaderBg, { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 40 : 20) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
          <TouchableOpacity onPress={() => router.push('/(sathi)/edit-profile')} style={styles.editHeaderBtn}>
            <Ionicons name="pencil" size={20} color={DEEP_ORANGE} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={{ zIndex: 10 }} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarContainer}>
            {profile?.profilePhoto ? (
              <Image source={{ uri: sanitizeImageUri(profile.profilePhoto) }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={50} color="#9CA3AF" />
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.editBadge} 
              onPress={handlePickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.profileName}>{profile?.name}</Text>
            <Text style={styles.profileAge}>{profile?.age ? `${profile.age} years old` : ''}</Text>
            
            <TouchableOpacity style={styles.statsRow} onPress={fetchReviews}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.ratingText}>{profile?.rating || 'New'}</Text>
              </View>
              <Text style={styles.visitsText}>
                {profile?.totalVisits || 0} visits completed
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#6B7280" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.locationText}>
                {profile?.city ? `${profile.city}${profile?.state ? ` - ${profile.state}` : ''}` : 'Location pending'}
              </Text>
            </View>
          </View>
        </View>

        {/* Credits & Rewards Banner Option */}
        <TouchableOpacity
          style={styles.creditsCard}
          onPress={() => router.push('/(sathi)/credits')}
        >
          <View style={styles.creditsIconBox}>
            <Ionicons name="gift" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: scale(14) }}>
            <Text style={styles.creditsTitle}>Credits & Rewards</Text>
          </View>
          <View style={styles.creditsActionBadge}>
            <Text style={styles.creditsActionText}>Redeem</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>
        </TouchableOpacity>

        {/* Details Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age</Text>
            <Text style={styles.infoValue}>{profile?.age || 'Not provided'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gender</Text>
            <Text style={styles.infoValue}>{profile?.gender || 'Not provided'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile?.phone}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Address</Text>
          
          <Text style={styles.addressText}>
            {[
              profile?.flatPlot,
              profile?.streetArea,
              profile?.landmark,
              profile?.city,
              profile?.state,
              profile?.pincode,
            ].filter(Boolean).join(', ') || 'No address provided'}
          </Text>
        </View>

        {profile?.interests?.length > 0 && (
          <View style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="heart-outline" size={20} color="#FE6700" style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Interests & Activities</Text>
            </View>
            <View style={styles.chipContainer}>
              {profile.interests.map((interest: string, index: number) => (
                <View key={index} style={styles.chip}>
                  <Text style={styles.chipText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {profile?.whyJoin && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{profile.whyJoin}</Text>
          </View>
        )}

        {/* Support & Legal Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Help & Support</Text>
          
          <TouchableOpacity 
            style={styles.supportRow} 
            activeOpacity={0.7}
            onPress={handleOpenSupport}
          >
            <View style={styles.supportRowLeft}>
              <Ionicons name="help-circle-outline" size={20} color={DEEP_ORANGE} />
              <Text style={styles.supportRowText}>Contact Sathi Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.supportDivider} />

          <TouchableOpacity 
            style={styles.supportRow} 
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://maihoonna.in/#terms')}
          >
            <View style={styles.supportRowLeft}>
              <Ionicons name="document-text-outline" size={20} color="#7C3AED" />
              <Text style={styles.supportRowText}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.supportDivider} />

          <TouchableOpacity 
            style={styles.supportRow} 
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://maihoonna.in/#privacy')}
          >
            <View style={styles.supportRowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#0D9488" />
              <Text style={styles.supportRowText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Logout Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={logoutModalVisible}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="log-out-outline" size={28} color={DEEP_ORANGE} />
              <Text style={styles.modalTitle}>Log out</Text>
            </View>
            <Text style={styles.modalMessage}>Are you sure you want to log out of your account?</Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalLogoutBtn} 
                onPress={confirmLogout}
              >
                <Text style={styles.modalLogoutBtnText}>Log out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reviews Modal */}
      <Modal visible={reviewsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>My Reviews</Text>
              <TouchableOpacity onPress={() => setReviewsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            
            {fetchingReviews ? (
              <ActivityIndicator size="large" color={DEEP_ORANGE} style={{ marginVertical: 40 }} />
            ) : reviews.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#6B7280', marginVertical: 40 }}>No reviews yet.</Text>
            ) : (
              <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                {reviews.map((rev, index) => (
                  <View key={index} style={{ marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      {rev.beneficiary?.subscriber?.profilePhoto ? (
                        <Image source={{ uri: sanitizeImageUri(rev.beneficiary.subscriber.profilePhoto) }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 8 }} />
                      ) : (
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB', marginRight: 8, justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="person" size={16} color="#9CA3AF" />
                        </View>
                      )}
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                          {rev.beneficiary?.subscriber?.name || 'User'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="star" size={12} color="#F59E0B" />
                          <Text style={{ fontSize: 12, color: '#4B5563', marginLeft: 4 }}>{rev.rating}</Text>
                        </View>
                      </View>
                    </View>
                    {rev.reviewText ? (
                      <Text style={{ fontSize: 14, color: '#4B5563', lineHeight: 20 }}>"{rev.reviewText}"</Text>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <CareSupportModal
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
      />

      <SathiBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Off-white for body
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: scale(12),
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
  },
  orangeHeaderBg: {
    backgroundColor: DEEP_ORANGE,
    paddingBottom: scale(16),
    borderBottomLeftRadius: scale(24),
    borderBottomRightRadius: scale(24),
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingTop: scale(10),
    paddingBottom: scale(10),
  },
  title: {
    fontSize: scale(22),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editHeaderBtn: {
    padding: scale(8),
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: scale(16),
    paddingBottom: scale(120),
    paddingTop: scale(8),
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    padding: scale(16),
    marginTop: scale(16),
    marginBottom: scale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: scale(16),
  },
  avatarImage: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: DEEP_ORANGE,
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerTextContainer: {
    flex: 1,
  },
  profileName: {
    fontSize: scale(20),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(2),
  },
  profileAge: {
    fontSize: scale(14),
    color: '#6B7280',
    marginBottom: scale(8),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(6),
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(12),
    marginRight: scale(8),
  },
  ratingText: {
    fontSize: scale(12),
    fontWeight: '700',
    color: '#D97706',
    marginLeft: scale(4),
  },
  visitsText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: '#6B7280',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: scale(13),
    color: '#6B7280',
    marginLeft: scale(4),
  },
  creditsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  creditsIconBox: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(12),
    backgroundColor: DEEP_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creditsTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  creditsActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  creditsActionText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    padding: scale(20),
    marginBottom: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  sectionTitle: {
    fontSize: scale(17),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scale(12),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: scale(14),
    color: '#6B7280',
  },
  infoValue: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#111827',
  },
  addressText: {
    fontSize: scale(14),
    color: '#4B5563',
    lineHeight: scale(22),
  },
  bioText: {
    fontSize: scale(14),
    color: '#4B5563',
    lineHeight: scale(22),
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
  },
  chip: {
    backgroundColor: '#FFF5F0',
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: scale(20),
  },
  chipText: {
    fontSize: scale(13),
    color: '#7C3AED', // Purple like the Figma design
    fontWeight: '500',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(12),
  },
  supportRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  supportRowText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#1F2937',
  },
  supportDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    padding: scale(16),
    borderRadius: scale(16),
    marginTop: scale(8),
    gap: scale(8),
  },
  logoutText: {
    fontSize: scale(15),
    fontWeight: '700',
    color: '#EF4444',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626', // darker red for delete
    padding: scale(16),
    borderRadius: scale(16),
    marginTop: scale(16),
    gap: scale(8),
  },
  deleteText: {
    fontSize: scale(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    padding: scale(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
    gap: scale(10),
  },
  modalTitle: {
    fontSize: scale(20),
    fontWeight: '700',
    color: '#111827',
  },
  modalMessage: {
    fontSize: scale(15),
    color: '#4B5563',
    lineHeight: scale(22),
    marginBottom: scale(24),
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: scale(12),
  },
  modalCancelBtn: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
    borderRadius: scale(10),
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#4B5563',
  },
  modalLogoutBtn: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(20),
    borderRadius: scale(10),
    backgroundColor: '#FEF2F2',
  },
  modalLogoutBtnText: {
    fontSize: scale(15),
    fontWeight: '700',
    color: '#EF4444',
  },
});
