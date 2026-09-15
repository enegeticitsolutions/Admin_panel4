import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '@/constants/api';
import { AddressPicker, SelectedAddress } from '@/components/ui/AddressPicker';

const DEEP_ORANGE = '#FE6700';

const PREDEFINED_INTERESTS = [
  'Cooking',
  'Music',
  'Traveling',
  'Yoga/Exercise',
  'Reading',
  'Sports',
  'Art',
  'Technology',
  'Gardening',
  'Movies'
];

export default function EditProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // Form State
  const [age, setAge] = useState('');
  const [isAgeLocked, setIsAgeLocked] = useState(false);
  const [gender, setGender] = useState('');
  const [whyJoin, setWhyJoin] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [languagesStr, setLanguagesStr] = useState('');
  
  // Location State
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [addressDetails, setAddressDetails] = useState<Partial<SelectedAddress>>({});

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert('Error', 'Not authenticated');
        router.back();
        return;
      }

      const response = await fetch(`${API_URL}/sathi/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      if (!response.ok) throw new Error('Profile fetch error');
      const data = await response.json();
      const p = data.data || data;
      setProfile(p);
      
      // Initialize form fields
      if (p.age) {
        setAge(p.age.toString());
        setIsAgeLocked(true);
      }
      setGender(p.gender || '');
      setWhyJoin(p.whyJoin || '');
      setInterests(p.interests || []);
      setAvailability(p.availability || []);
      setLanguagesStr((p.languages || []).join(', '));
      setAddressDetails({
        address: [p.flatPlot, p.streetArea, p.landmark, p.city, p.state, p.pincode].filter(Boolean).join(', '),
        flatPlot: p.flatPlot,
        streetArea: p.streetArea,
        city: p.city,
        state: p.state,
        pincode: p.pincode,
        latitude: p.latitude,
        longitude: p.longitude,
      });
    } catch (error) {
      console.log('Error fetching profile:', error);
      Alert.alert('Error', 'Could not load profile to edit.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const toggleAvailability = (opt: string) => {
    if (availability.includes(opt)) {
      setAvailability(availability.filter(a => a !== opt));
    } else {
      setAvailability([...availability, opt]);
    }
  };

  const handleAddressSelected = (selected: SelectedAddress) => {
    setAddressDetails(selected);
    setShowAddressPicker(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('userToken');
      
      const payload: any = {
        gender,
        whyJoin,
        interests,
        availability,
        languages: languagesStr.split(',').map(l => l.trim()).filter(Boolean),
        flatPlot: addressDetails.flatPlot || '',
        streetArea: addressDetails.streetArea || addressDetails.address || '',
        city: addressDetails.city || '',
        state: addressDetails.state || '',
        pincode: addressDetails.pincode || '',
      };

      if (addressDetails.latitude && addressDetails.longitude) {
        payload.latitude = addressDetails.latitude;
        payload.longitude = addressDetails.longitude;
      }

      if (!isAgeLocked && age) {
        const parsedAge = parseInt(age, 10);
        if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 100) {
          Alert.alert('Invalid Age', 'Please enter a valid age between 18 and 100.');
          setSaving(false);
          return;
        }
        payload.age = parsedAge;
      }

      const response = await fetch(`${API_URL}/sathi/profile`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Update failed');

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Update Error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={DEEP_ORANGE} />
          <Text style={styles.loaderText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Read-only Personal Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={profile?.name || ''}
              editable={false}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={profile?.phone || ''}
              editable={false}
            />
          </View>
        </View>

        {/* Editable Personal Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Age {isAgeLocked ? '(Locked)' : ''}</Text>
            <TextInput
              style={[styles.input, isAgeLocked && styles.inputDisabled]}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              editable={!isAgeLocked}
              placeholder="Enter your age"
            />
            {!isAgeLocked && (
              <Text style={styles.hintText}>Age can only be set once.</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipContainer}>
              {['Male', 'Female', 'Other'].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, gender === g && styles.chipSelected]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.chipText, gender === g && styles.chipTextSelected]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address & Location</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationIcon}>
              <Feather name="map-pin" size={20} color={DEEP_ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationText}>
                {addressDetails.address || 'No address selected'}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.locationBtn}
              onPress={() => setShowAddressPicker(true)}
            >
              <Text style={styles.locationBtnText}>Update</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <Text style={styles.label}>Weekdays</Text>
          <View style={[styles.chipContainer, { marginBottom: 16 }]}>
            {['Weekday morning (6.00 am - 1.00 pm)', 'Weekday evening (1.00 pm - 7.00 pm)'].map((opt) => {
              const isSelected = availability.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleAvailability(opt)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {opt.replace('Weekday ', '')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.label}>Weekends</Text>
          <View style={styles.chipContainer}>
            {['Weekend morning (6.00 am - 1.00 pm)', 'Weekend evening (1.00 pm - 7.00 pm)'].map((opt) => {
              const isSelected = availability.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleAvailability(opt)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {opt.replace('Weekend ', '')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Languages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Languages</Text>
          <TextInput
            style={styles.input}
            value={languagesStr}
            onChangeText={setLanguagesStr}
            placeholder="e.g. Hindi, English, Punjabi"
          />
        </View>

        {/* Interests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.chipContainer}>
            {PREDEFINED_INTERESTS.map((interest) => {
              const isSelected = interests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Why I Joined */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why I Joined</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={whyJoin}
            onChangeText={setWhyJoin}
            multiline
            numberOfLines={4}
            placeholder="Share why you decided to become a Sathi..."
            textAlignVertical="top"
          />
        </View>

      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Address Picker Modal */}
      <Modal visible={showAddressPicker} animationType="slide" transparent>
        <AddressPicker 
          onAddressSelected={handleAddressSelected}
          onCancel={() => setShowAddressPicker(false)}
          title="Update Address"
        />
      </Modal>

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
  },
  loaderText: {
    marginTop: 12,
    color: '#6B7280',
    fontFamily: 'Poppins-Medium',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FAF3EB',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  hintText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: '#FFF5ED',
    borderColor: DEEP_ORANGE,
  },
  chipText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: DEEP_ORANGE,
    fontWeight: '600',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF5ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  locationBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 12,
  },
  locationBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveBtn: {
    backgroundColor: DEEP_ORANGE,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
