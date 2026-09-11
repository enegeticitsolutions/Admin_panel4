import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Modal,
  Image,
  Linking,
  AppState,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@/components/ui/DateTimePickerWrapper';


import { API_URL } from '@/constants/api';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';
import { AddressInputField } from '@/components/ui/AddressInputField';
import { useAuth } from '@/contexts/AuthContext';
import { LegalConsentModal } from '@/components/shared/LegalConsentModal';

const { width } = Dimensions.get('window');
const scale = (size: number) => Math.round((width / 390) * size);

type ApplicationStatus = 'NOT_APPLIED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export default function ApplyVolunteerScreen() {
  const { replace } = useNavigationStack();
  const { logout, user, updateUser } = useAuth();
  useAndroidBackHandler();

  // ─── Status State ────────────────────────────────────────────────────────────
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  // ─── Form State ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    gender: '',
    previousExperience: '',
    whyJoin: '',
  });
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [address, setAddress] = useState('');
  const [flatPlot, setFlatPlot] = useState('');
  const [streetArea, setStreetArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [availableInterests, setAvailableInterests] = useState<string[]>([]);
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [consentBackground, setConsentBackground] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Fetch Profile and Hobbies ──────────────────────────────────────────────
  const fetchProfile = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsRefreshingStatus(true);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        replace('/(auth)');
        return;
      }

      const response = await fetch(`${API_URL}/sathi/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const res = await response.json();
        const profile = res.data || res;

        setApplicationStatus(profile.applicationStatus as ApplicationStatus);
        setRejectionReason(profile.rejectionReason || null);

        // If approved, update user session and redirect directly to dashboard
        if (profile.applicationStatus === 'APPROVED') {
          if (user) {
            await updateUser(token, {
              ...user,
              applicationStatus: 'APPROVED',
              role: 'volunteer',
            });
          }
          replace('/(sathi)');
          return;
        }

        // Prefill form fields if not already submitted
        if (profile.applicationStatus !== 'SUBMITTED') {
          setForm({
            name: profile.name || '',
            email: profile.email || '',
            phone: profile.phone || '',
            gender: profile.gender || '',
            previousExperience: profile.previousExperience || '',
            whyJoin: profile.whyJoin || '',
          });
          if (profile.address) setAddress(profile.address);
          if (profile.flatPlot) setFlatPlot(profile.flatPlot);
          if (profile.streetArea) setStreetArea(profile.streetArea);
          if (profile.landmark) setLandmark(profile.landmark);
          if (profile.city) setCity(profile.city);
          if (profile.state) setState(profile.state);
          if (profile.pincode) setPincode(profile.pincode);
          if (profile.latitude) setLatitude(profile.latitude);
          if (profile.longitude) setLongitude(profile.longitude);
          if (profile.interests?.length > 0) setSelectedInterests(profile.interests);
        }
      } else {
        if (!silent) setApplicationStatus('NOT_APPLIED');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (!silent) {
        setApplicationStatus('NOT_APPLIED');
      }
    } finally {
      setIsFetchingProfile(false);
      setIsRefreshingStatus(false);
    }
  }, [user, updateUser, replace]);

  const fetchHobbies = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/public/hobbies?activeOnly=true`);
      if (response.ok) {
        const res = await response.json();
        if (res.success && res.data) {
          setAvailableInterests(res.data.map((h: any) => h.name));
        }
      }
    } catch (error) {
      console.error('Error fetching hobbies:', error);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchProfile(false);
    fetchHobbies();
  }, [fetchProfile, fetchHobbies]);

  // Polling interval when in SUBMITTED state (auto-checks every 12 seconds)
  useEffect(() => {
    if (applicationStatus !== 'SUBMITTED') return;

    const intervalId = setInterval(() => {
      fetchProfile(true);
    }, 12000);

    return () => clearInterval(intervalId);
  }, [applicationStatus, fetchProfile]);

  // AppState listener (re-checks immediately when user returns from background / notification)
  useEffect(() => {
    if (applicationStatus !== 'SUBMITTED') return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchProfile(true);
      }
    });

    return () => subscription.remove();
  }, [applicationStatus, fetchProfile]);

  // ─── Interest Helpers ────────────────────────────────────────────────────────
  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // ─── Submit Handler ──────────────────────────────────────────────────────────
  const handleSubmitApplication = async () => {
    console.log('[Apply] Submit tapped', { form, address, consentGiven, consentBackground });
    setFormError(null);

    // Inline validation — visible on web
    if (!form.name.trim()) {
      setFormError('Full Name is required.');
      return;
    }
    if (!city || !state || !pincode) {
      setFormError('City, State, and Pincode are required. Please pick an accurate location.');
      return;
    }
    if (!dateOfBirth) {
      setFormError('Date of birth is required.');
      return;
    }

    // Calculate age
    const today = new Date();
    let calculatedAge = today.getFullYear() - dateOfBirth.getFullYear();
    const m = today.getMonth() - dateOfBirth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) {
      calculatedAge--;
    }

    if (calculatedAge < 18) {
      setFormError('You must be at least 18 years old to register as a Saathi.');
      return;
    }
    if (!consentGiven) {
      setFormError('You must agree to the Terms of Service, Privacy Policy, and Child Safety Standards to proceed.');
      return;
    }
    if (!consentBackground) {
      setFormError('You must consent to background verification to proceed.');
      return;
    }

    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      console.log('[Apply] Sending to:', `${API_URL}/sathi/profile/apply`);

      const response = await fetch(`${API_URL}/sathi/profile/apply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          age: calculatedAge,
          gender: form.gender.trim() || null,
          address: address.trim() || null,
          flatPlot: flatPlot.trim() || null,
          streetArea: streetArea.trim() || null,
          landmark: landmark.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          pincode: pincode.trim() || null,
          latitude: latitude || null,
          longitude: longitude || null,
          previousExperience: form.previousExperience.trim() || null,
          whyJoin: form.whyJoin.trim() || null,
          interests: selectedInterests,
        }),
      });

      const data = await response.json();
      console.log('[Apply] Response:', response.status, data);

      if (response.ok || data.success) {
        // Switch in-place to Under Review screen
        setApplicationStatus('SUBMITTED');
      } else {
        setFormError(data.message || 'Failed to submit application. Please try again.');
      }
    } catch (error: any) {
      console.error('[Apply] Submission Error:', error);
      setFormError('Network error — could not reach server. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Loading Spinner ─────────────────────────────────────────────────────────
  if (isFetchingProfile) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF6F00" />
        <Text style={styles.loaderText}>Checking your application status...</Text>
      </View>
    );
  }

  // ─── UNDER REVIEW screen (SUBMITTED pending) ──────────────────────────────
  if (applicationStatus === 'SUBMITTED') {
    return (
      <SafeAreaView style={styles.reviewSafeArea}>
        <ScrollView
          contentContainerStyle={styles.reviewContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingStatus}
              onRefresh={() => fetchProfile(false)}
              colors={['#FE6700']}
              tintColor="#FE6700"
            />
          }
        >
          {/* Success Banner */}
          <View style={styles.reviewIconWrapper}>
            <View style={styles.reviewIconCircle}>
              <MaterialCommunityIcons name="clock-check-outline" size={scale(52)} color="#FF7A00" />
            </View>
          </View>

          <Text style={styles.reviewTitle}>Application Under Review</Text>
          <Text style={styles.reviewSubtitle}>
            Your profile has been submitted successfully.
          </Text>

          {/* Status Info Card */}
          <View style={styles.reviewInfoCard}>
            <View style={styles.reviewInfoRow}>
              <MaterialCommunityIcons name="circle-slice-8" size={scale(16)} color="#FF7A00" />
              <View style={styles.reviewInfoTextGroup}>
                <Text style={styles.reviewInfoLabel}>Status</Text>
                <Text style={[styles.reviewInfoValue, { color: '#FF7A00' }]}>
                  Under Review
                </Text>
              </View>
            </View>

            <View style={styles.reviewDivider} />

            <View style={styles.reviewInfoRow}>
              <MaterialCommunityIcons name="clock-outline" size={scale(16)} color="#6B7280" />
              <View style={styles.reviewInfoTextGroup}>
                <Text style={styles.reviewInfoLabel}>Estimated Time</Text>
                <Text style={styles.reviewInfoValue}>24–48 hours</Text>
              </View>
            </View>

            <View style={styles.reviewDivider} />

            <View style={styles.reviewInfoRow}>
              <MaterialCommunityIcons name="bell-outline" size={scale(16)} color="#6B7280" />
              <View style={styles.reviewInfoTextGroup}>
                <Text style={styles.reviewInfoLabel}>Notification</Text>
                <Text style={styles.reviewInfoValue}>
                  You will be notified once approved
                </Text>
              </View>
            </View>
          </View>

          {/* What happens next */}
          <View style={styles.nextStepsCard}>
            <Text style={styles.nextStepsTitle}>What happens next?</Text>

            <View style={styles.nextStep}>
              <View style={[styles.stepDot, { backgroundColor: '#FF7A00' }]} />
              <Text style={styles.stepText}>Our team reviews your profile details</Text>
            </View>
            <View style={styles.nextStep}>
              <View style={[styles.stepDot, { backgroundColor: '#FF7A00' }]} />
              <Text style={styles.stepText}>Background verification check is completed</Text>
            </View>
            <View style={styles.nextStep}>
              <View style={[styles.stepDot, { backgroundColor: '#D1D5DB' }]} />
              <Text style={styles.stepText}>You receive an approval notification</Text>
            </View>
            <View style={styles.nextStep}>
              <View style={[styles.stepDot, { backgroundColor: '#D1D5DB' }]} />
              <Text style={styles.stepText}>Start matching with seniors in your area!</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.checkStatusBtn}
            onPress={() => fetchProfile(false)}
            disabled={isRefreshingStatus}
            activeOpacity={0.8}
          >
            {isRefreshingStatus ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="refresh" size={scale(18)} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.checkStatusBtnText}>Check Approval Status</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportBtn}
            onPress={() =>
              Alert.alert(
                'Contact Support',
                'Please reach out to us at support@maihoona.com for any queries.'
              )
            }
          >
            <MaterialCommunityIcons name="headset" size={scale(16)} color="#FF7A00" />
            <Text style={styles.supportBtnText}>Contact Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert('Logout', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Logout',
                  style: 'destructive',
                  onPress: async () => {
                    await logout();
                    replace('/(auth)');
                  },
                },
              ]);
            }}
          >
            <MaterialCommunityIcons name="logout" size={scale(16)} color="#6B7280" />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── REJECTED screen ─────────────────────────────────────────────────────────
  if (applicationStatus === 'REJECTED') {
    return (
      <SafeAreaView style={styles.reviewSafeArea}>
        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.reviewIconWrapper}>
            <View style={[styles.reviewIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="account-cancel" size={scale(52)} color="#EF4444" />
            </View>
          </View>

          <Text style={[styles.reviewTitle, { color: '#EF4444' }]}>Application Not Approved</Text>
          <Text style={styles.reviewSubtitle}>
            Unfortunately, your application could not be approved at this time.
          </Text>

          {rejectionReason && (
            <View style={[styles.reviewInfoCard, { borderColor: '#FCA5A5' }]}>
              <Text style={[styles.reviewInfoLabel, { color: '#EF4444' }]}>Reason</Text>
              <Text style={[styles.reviewInfoValue, { color: '#DC2626' }]}>{rejectionReason}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.supportBtn}
            onPress={() =>
              Alert.alert(
                'Contact Support',
                'Please reach out to us at support@maihoona.com for any queries.'
              )
            }
          >
            <MaterialCommunityIcons name="headset" size={scale(16)} color="#FF7A00" />
            <Text style={styles.supportBtnText}>Contact Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert('Logout', 'Are you sure you want to log out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Logout',
                  style: 'destructive',
                  onPress: async () => {
                    await logout();
                    replace('/(auth)');
                  },
                },
              ]);
            }}
          >
            <MaterialCommunityIcons name="logout" size={scale(16)} color="#6B7280" />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── APPLICATION FORM (NOT_APPLIED) ──────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Editorial Intro */}
          <View style={styles.editorialIntro}>
            <Text style={styles.subHeadingOrange}>JOIN THE COLLECTIVE</Text>
            <Text style={styles.headingBlack}>Register as a Saathi</Text>
            <Text style={styles.description}>
              Become a companion in our thriving community. Your presence is the warmth that
              makes our hearth glow.
            </Text>
          </View>

          {/* Feature Highlights */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureRow}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="heart-outline" size={20} color="#713B00" />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Community First</Text>
                <Text style={styles.featureDesc}>Connect with people who share your heart.</Text>
              </View>
            </View>
            <View style={styles.featureRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
                <MaterialCommunityIcons name="shield-check-outline" size={20} color="#16A34A" />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Safe & Secure</Text>
                <Text style={styles.featureDesc}>Your privacy and safety are our priority.</Text>
              </View>
            </View>
          </View>

          {/* Welcome Illustration */}
          <View style={styles.welcomeImageContainer}>
            <Image
              source={require('../../assets/images/RegisterPageImage.png')}
              style={styles.welcomeImage}
              resizeMode="contain"
            />
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#9CA3AF"
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
                editable={!isLoading}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(t) => setForm({ ...form, email: t })}
                editable={!isLoading}
              />
            </View>

            {/* Phone (read-only) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.phoneRow, styles.disabledInput]}>
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  style={styles.phoneInput}
                  value={form.phone.replace('+91', '')}
                  editable={false}
                />
              </View>
            </View>

            {/* Age -> Date of Birth */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth *</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
                disabled={isLoading}
              >
                <Text style={[styles.datePickerText, !dateOfBirth && { color: '#9CA3AF' }]}>
                  {dateOfBirth ? dateOfBirth.toLocaleDateString() : 'Select your date of birth'}
                </Text>
                <MaterialCommunityIcons name="calendar" size={20} color="#6B7280" />
              </TouchableOpacity>

              {Platform.OS === 'ios' ? (
                <Modal visible={showDatePicker} transparent animationType="slide">
                  <View style={styles.iosPickerModalContainer}>
                    <View style={styles.iosPickerContainer}>
                      <View style={styles.iosPickerHeader}>
                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                          <Text style={styles.iosPickerDoneText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={dateOfBirth || new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
                        mode="date"
                        display="spinner"
                        maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
                        onChange={(event: any, selectedDate?: Date) => {
                          if (selectedDate) setDateOfBirth(selectedDate);
                        }}
                      />
                    </View>
                  </View>
                </Modal>
              ) : (
                showDatePicker && (
                  <DateTimePicker
                    value={dateOfBirth || new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
                    mode="date"
                    display="default"
                    maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
                    onChange={(event: any, selectedDate?: Date) => {
                      setShowDatePicker(false);
                      if (selectedDate) setDateOfBirth(selectedDate);
                    }}
                  />
                )
              )}
            </View>

            {/* Gender */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.radioGroup}>
                {['Male', 'Female', 'Other', 'Prefer Not to say'].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.radioOption}
                    onPress={() => setForm({ ...form, gender: option })}
                    disabled={isLoading}
                  >
                    <MaterialCommunityIcons
                      name={form.gender === option ? 'radiobox-marked' : 'radiobox-blank'}
                      size={22}
                      color={form.gender === option ? '#FE6700' : '#BDC9C9'}
                    />
                    <Text style={styles.radioText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Address */}
            <AddressInputField
              value={address}
              onChangeText={setAddress}
              onLocationFetched={(details) => {
                if (details.flatPlot) setFlatPlot(details.flatPlot);
                if (details.streetArea) setStreetArea(details.streetArea);
                if (details.city) setCity(details.city);
                if (details.state) setState(details.state);
                if (details.pincode) setPincode(details.pincode);
                if (details.latitude) setLatitude(details.latitude);
                if (details.longitude) setLongitude(details.longitude);
              }}
              label="Address"
              placeholder="Pick accurate location"
            />

            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <Text style={styles.label}>Flat / Plot / Building</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 402, Sunshine"
                  placeholderTextColor="#9CA3AF"
                  value={flatPlot}
                  onChangeText={setFlatPlot}
                />
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.label}>Street / Area *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Sector 15"
                  placeholderTextColor="#9CA3AF"
                  value={streetArea}
                  onChangeText={setStreetArea}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Landmark (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Near HDFC Bank"
                placeholderTextColor="#9CA3AF"
                value={landmark}
                onChangeText={setLandmark}
              />
            </View>

            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  placeholder="City"
                  placeholderTextColor="#9CA3AF"
                  value={city}
                  onChangeText={setCity}
                  editable={false}
                />
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.label}>Pincode *</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  placeholder="Pincode"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  maxLength={6}
                  value={pincode}
                  onChangeText={setPincode}
                  editable={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>State *</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                placeholder="State"
                placeholderTextColor="#9CA3AF"
                value={state}
                onChangeText={setState}
                editable={false}
              />
            </View>

            {/* Previous Experience */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Previous Volunteer Experience</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe any relevant experience..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                value={form.previousExperience}
                onChangeText={(t) => setForm({ ...form, previousExperience: t })}
                editable={!isLoading}
              />
            </View>

            {/* Interests */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Interests & Hobbies</Text>
              <Text style={styles.helpText}>Select the things you love to talk about.</Text>
              <View style={styles.tagsRow}>
                {(showAllInterests ? availableInterests : availableInterests.slice(0, 5)).map((tag) => {
                  const isSelected = selectedInterests.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleInterest(tag)}
                      style={[styles.tag, isSelected && styles.tagSelected]}
                    >
                      <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {availableInterests.length > 5 && (
                  <TouchableOpacity
                    onPress={() => setShowAllInterests(!showAllInterests)}
                    style={[styles.tag, styles.addTag]}
                  >
                    <Text style={styles.addTagText}>
                      {showAllInterests ? 'View Less' : `+ ${availableInterests.length - 5} More`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Why Join */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Why do you want to join?</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us a little bit about your journey..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                value={form.whyJoin}
                onChangeText={(t) => setForm({ ...form, whyJoin: t })}
                editable={!isLoading}
              />
            </View>

            {/* ── Data Consent Checkbox ── */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                  if (!consentGiven) {
                      setShowLegalModal(true);
                  } else {
                      setConsentGiven(false);
                  }
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, consentGiven && styles.checkboxActive]}>
                {consentGiven && (
                  <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>
                I have read and agree to the{' '}
                <Text
                  style={styles.orangeTextBold}
                  onPress={(e) => { e.stopPropagation?.(); setShowLegalModal(true); }}
                >
                  Privacy Policy
                </Text>{' '}
                and consent to processing of my personal data under the DPDP Act, 2023. I also agree to the Community Guidelines and understand that Saathi Network is built on mutual respect and empathy.
              </Text>
            </TouchableOpacity>

            {/* Checkbox: Background Verification */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setConsentBackground(!consentBackground)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, consentBackground && styles.checkboxActive]}>
                {consentBackground && (
                  <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>
                I consent to the background verification.
              </Text>
            </TouchableOpacity>

            {/* Inline Error Banner */}
            {formError && (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={scale(16)} color="#DC2626" />
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, (isLoading || !consentGiven || !consentBackground) && styles.submitButtonDisabled]}
              onPress={handleSubmitApplication}
              disabled={isLoading || !consentGiven || !consentBackground}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Application</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LegalConsentModal
        visible={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        onAccept={() => {
            setConsentGiven(true);
            setShowLegalModal(false);
        }}
        requireConsent={!consentGiven}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Shared ──
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF0E6',
    gap: scale(12),
  },
  loaderText: {
    fontSize: scale(14),
    color: '#6B7280',
  },

  // ── Form screen ──
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF0E6',
  },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: scale(20),
    paddingTop: scale(24),
    paddingBottom: scale(40),
  },
  editorialIntro: { marginBottom: scale(24) },
  subHeadingOrange: {
    fontSize: scale(11),
    fontWeight: '700',
    color: '#FF5733',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: scale(6),
  },
  headingBlack: {
    fontSize: scale(20),
    fontWeight: '700',
    color: '#000000',
    marginBottom: scale(8),
  },
  description: {
    fontSize: scale(14),
    lineHeight: scale(20),
    color: '#4A5565',
  },
  featuresContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(24),
    gap: scale(16),
    borderWidth: 1,
    borderColor: '#FFE3D1',
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  iconCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 164, 84, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextContainer: { flex: 1 },
  featureTitle: { fontSize: scale(15), fontWeight: '700', color: '#000', marginBottom: scale(2) },
  featureDesc: { fontSize: scale(12), color: '#3E4949' },
  welcomeImageContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(24),
    alignItems: 'center',
    shadowColor: '#181C1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  welcomeImage: {
    width: '100%',
    height: scale(220),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(20),
    shadowColor: '#181C1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  inputGroup: { marginBottom: scale(16) },
  label: { fontSize: scale(13), color: '#111827', marginBottom: scale(6), fontWeight: '600' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DC',
    borderRadius: scale(6),
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    fontSize: scale(14),
    color: '#111827',
    minHeight: scale(44),
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  radioGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(12), marginTop: scale(4) },
  radioOption: { flexDirection: 'row', alignItems: 'center', gap: scale(6), marginRight: scale(8) },
  radioText: { fontSize: scale(14), color: '#3E4949' },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DC',
    borderRadius: scale(6),
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
  },
  datePickerText: { fontSize: scale(14), color: '#111827' },
  iosPickerModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  iosPickerContainer: {
    backgroundColor: '#FFFFFF',
    paddingBottom: scale(20),
  },
  iosPickerHeader: {
    padding: scale(16),
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  iosPickerDoneText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: scale(16),
  },
  disabledInput: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DC',
    borderRadius: scale(6),
    paddingHorizontal: scale(12),
  },
  countryCode: {
    fontSize: scale(14),
    color: '#4B5563',
    fontWeight: '600',
    borderRightWidth: 1,
    borderRightColor: '#D1D5DC',
    paddingRight: scale(8),
    marginRight: scale(8),
  },
  phoneInput: { flex: 1, paddingVertical: scale(10), fontSize: scale(14), color: '#111827' },
  textArea: { height: scale(80), textAlignVertical: 'top' },
  helpText: { fontSize: scale(11), color: '#6E797A', marginBottom: scale(8) },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8) },
  tag: { backgroundColor: '#F3F3F3', paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: scale(20) },
  tagSelected: { backgroundColor: '#FE6700' },
  tagText: { fontSize: scale(13), color: '#3E4949', fontWeight: '500' },
  tagTextSelected: { color: '#FFFFFF' },
  gridRow: { flexDirection: 'row', gap: scale(12), marginBottom: scale(16) },
  gridCol: { flex: 1 },
  customInterestInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BDC9C9',
    borderRadius: scale(20),
    paddingLeft: scale(12),
    paddingRight: scale(4),
  },
  customInterestInput: { paddingVertical: scale(4), fontSize: scale(13), width: scale(80), color: '#3E4949' },
  customInterestAddBtn: {
    backgroundColor: '#FE6700',
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  addTag: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#BDC9C9' },
  addTagText: { fontSize: scale(13), color: '#3E4949' },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: scale(10), marginBottom: scale(16) },
  checkbox: {
    width: scale(18),
    height: scale(18),
    borderWidth: 1.5,
    borderColor: '#BDC9C9',
    borderRadius: scale(4),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: scale(2),
  },
  checkboxActive: { backgroundColor: '#FE6700', borderColor: '#FE6700' },
  checkboxLabel: { flex: 1, fontSize: scale(13), lineHeight: scale(18), color: '#111827' },
  orangeTextBold: { color: '#FF5733', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#FE6700',
    paddingVertical: scale(14),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(8),
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: scale(15) },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(8),
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: scale(8),
    padding: scale(12),
    marginBottom: scale(12),
  },
  errorBannerText: {
    flex: 1,
    fontSize: scale(13),
    color: '#DC2626',
    lineHeight: scale(18),
    fontWeight: '500',
  },

  // ── Under Review / Rejection screen ──
  reviewSafeArea: {
    flex: 1,
    backgroundColor: '#FFFBF7',
  },
  reviewContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: scale(24),
    paddingTop: scale(48),
    paddingBottom: scale(40),
  },
  reviewIconWrapper: { marginBottom: scale(24) },
  reviewIconCircle: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewTitle: {
    fontSize: scale(22),
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: scale(8),
  },
  reviewSubtitle: {
    fontSize: scale(14),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: scale(22),
    marginBottom: scale(28),
    paddingHorizontal: scale(12),
  },
  reviewInfoCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#FFE3D1',
    padding: scale(20),
    marginBottom: scale(20),
    gap: scale(4),
  },
  reviewInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(12),
    paddingVertical: scale(8),
  },
  reviewInfoTextGroup: { flex: 1 },
  reviewInfoLabel: { fontSize: scale(12), color: '#9CA3AF', fontWeight: '500', marginBottom: scale(2) },
  reviewInfoValue: { fontSize: scale(14), color: '#111827', fontWeight: '600' },
  reviewDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: scale(-4) },
  nextStepsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: scale(20),
    marginBottom: scale(24),
    gap: scale(12),
  },
  nextStepsTitle: { fontSize: scale(14), fontWeight: '700', color: '#374151', marginBottom: scale(4) },
  nextStep: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  stepDot: { width: scale(8), height: scale(8), borderRadius: scale(4) },
  stepText: { fontSize: scale(13), color: '#4B5563', flex: 1 },
  checkStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FE6700',
    paddingVertical: scale(14),
    paddingHorizontal: scale(24),
    borderRadius: scale(12),
    marginBottom: scale(12),
    width: '100%',
    shadowColor: '#FE6700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  checkStatusBtnText: {
    fontSize: scale(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    borderWidth: 1.5,
    borderColor: '#FF7A00',
    borderRadius: scale(10),
    paddingVertical: scale(12),
    paddingHorizontal: scale(24),
    marginBottom: scale(12),
    width: '100%',
    justifyContent: 'center',
  },
  supportBtnText: { color: '#FF7A00', fontWeight: '700', fontSize: scale(14) },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingVertical: scale(12),
    justifyContent: 'center',
  },
  logoutBtnText: { color: '#6B7280', fontWeight: '600', fontSize: scale(13) },
});
