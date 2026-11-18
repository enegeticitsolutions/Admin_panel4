import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { useAuth } from '@/contexts/AuthContext';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { requireAuth } = useAuth();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [rsvpLoading, setRsvpLoading] = useState<boolean>(false);
  const [userRegistration, setUserRegistration] = useState<any>(null);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/community/events/${id}`, { headers });
      const json = await res.json();
      if (json.success && json.data) {
        setEvent(json.data.event);
        setUserRegistration(json.data.userRegistration || null);
      }
    } catch (e) {
      console.error('Fetch event detail error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchEventDetails();
  }, [id]);

  const handleRsvp = async () => {
    if (requireAuth('Create an account to register for community health events and interactive webinars.')) {
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert('Sign In Required', 'Please sign in to RSVP for this community event.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/(auth)') },
        ]);
        return;
      }

      setRsvpLoading(true);
      const res = await fetch(`${API_URL}/community/events/${id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const json = await res.json();

      if (json.success) {
        setUserRegistration(json.data.registration);
        const status = json.data.registration?.status;
        if (status === 'waitlisted') {
          Alert.alert('Added to Waitlist', 'This event is currently full. You have been added to the waitlist and will be notified if a spot opens up!');
        } else {
          Alert.alert('RSVP Confirmed', 'You have successfully registered for this event. See you there!');
        }
      } else {
        Alert.alert('RSVP Failed', json.message || 'Unable to complete event registration.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error while registering.');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleCancelRsvp = async () => {
    Alert.alert(
      'Cancel RSVP',
      'Are you sure you want to cancel your registration for this event?',
      [
        { text: 'No, Keep It', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setRsvpLoading(true);
              const token = await AsyncStorage.getItem('userToken');
              const res = await fetch(`${API_URL}/community/events/${id}/register`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              const json = await res.json();
              if (json.success) {
                setUserRegistration(null);
                Alert.alert('Cancelled', 'Your event registration has been cancelled.');
                fetchEventDetails();
              }
            } catch (err) {
              console.error('Cancel RSVP error:', err);
            } finally {
              setRsvpLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !event) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FE6700" />
      </SafeAreaView>
    );
  }

  const isConfirmed = userRegistration?.status === 'confirmed';
  const isWaitlisted = userRegistration?.status === 'waitlisted';
  const isFull = event.currentRegistrations >= event.maxCapacity;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ── Top Bar ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Event Details</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {event.resolvedThumbnailUrl && (
          <Image source={{ uri: event.resolvedThumbnailUrl }} style={styles.bannerImage} resizeMode="cover" />
        )}

        <View style={styles.contentBody}>
          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: event.eventType === 'online' ? '#EFF6FF' : '#FEF3C7' }]}>
              <Text style={[styles.typeBadgeText, { color: event.eventType === 'online' ? '#1D4ED8' : '#B45309' }]}>
                {event.eventType.toUpperCase()}
              </Text>
            </View>
            {event.category && (
              <Text style={styles.categoryBadge}>{event.category.name}</Text>
            )}
          </View>

          <Text style={styles.title}>{event.title}</Text>

          {/* ── Date & Timing Card ── */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={20} color="#FE6700" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Date & Time</Text>
                <Text style={styles.infoValue}>
                  {new Date(event.startDateTime).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
                <Text style={styles.infoSubValue}>
                  {new Date(event.startDateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} - {new Date(event.endDateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>

            {/* Location or Meeting Link */}
            {event.eventType === 'online' ? (
              <View style={[styles.infoRow, { marginTop: 12 }]}>
                <Feather name="video" size={20} color="#2563EB" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Platform</Text>
                  <Text style={styles.infoValue}>Online Interactive Video Session</Text>
                  {isConfirmed && event.meetingUrl && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(event.meetingUrl)}
                      style={styles.joinLinkButton}
                    >
                      <Text style={styles.joinLinkText}>Tap to Join Meeting Link</Text>
                      <Feather name="external-link" size={14} color="#2563EB" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={[styles.infoRow, { marginTop: 12 }]}>
                <Feather name="map-pin" size={20} color="#DC2626" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Venue Location</Text>
                  <Text style={styles.infoValue}>{event.venueName || 'Designated Center'}</Text>
                  <Text style={styles.infoSubValue}>{event.venueAddress || 'Address provided upon confirmation'}</Text>
                </View>
              </View>
            )}
          </View>

          {/* ── Host / Speaker Card ── */}
          {event.host && (
            <View style={styles.hostCard}>
              <Text style={styles.sectionHeading}>Speaker & Host</Text>
              <View style={styles.hostProfileRow}>
                {event.host.avatarUrl ? (
                  <Image source={{ uri: event.host.avatarUrl }} style={styles.hostAvatar} />
                ) : (
                  <View style={styles.hostAvatarPlaceholder}>
                    <Text style={styles.hostInitial}>{event.host.name[0]}</Text>
                  </View>
                )}
                <View style={styles.hostTextGroup}>
                  <Text style={styles.hostName}>{event.host.name}</Text>
                  <Text style={styles.hostDesignation}>{event.host.designation || 'Health Expert'}</Text>
                </View>
              </View>
              {event.host.bio && (
                <Text style={styles.hostBio}>{event.host.bio}</Text>
              )}
            </View>
          )}

          {/* ── Detailed Description ── */}
          <View style={styles.descSection}>
            <Text style={styles.sectionHeading}>About This Event</Text>
            <Text style={styles.bodyDescription}>
              {event.detailedDescription || event.shortDescription}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Fixed Bottom RSVP Action Bar ── */}
      <View style={styles.bottomBar}>
        {isConfirmed ? (
          <View style={styles.confirmedActionRow}>
            <View style={styles.confirmedStatusBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <Text style={styles.confirmedStatusText}>You are Registered!</Text>
            </View>
            <TouchableOpacity onPress={handleCancelRsvp} style={styles.cancelLinkButton}>
              <Text style={styles.cancelLinkText}>Cancel RSVP</Text>
            </TouchableOpacity>
          </View>
        ) : isWaitlisted ? (
          <View style={styles.confirmedActionRow}>
            <View style={[styles.confirmedStatusBadge, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time" size={20} color="#D97706" />
              <Text style={[styles.confirmedStatusText, { color: '#B45309' }]}>On Waitlist</Text>
            </View>
            <TouchableOpacity onPress={handleCancelRsvp} style={styles.cancelLinkButton}>
              <Text style={styles.cancelLinkText}>Leave Waitlist</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.rsvpMainButton, isFull && styles.waitlistMainButton]}
            onPress={handleRsvp}
            disabled={rsvpLoading}
          >
            {rsvpLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.rsvpMainButtonText}>
                {isFull ? 'Join Event Waitlist' : 'RSVP for Event (Free)'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 6,
    marginRight: 10,
  },
  headerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#0F172A',
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  bannerImage: {
    width: '100%',
    height: 220,
  },
  contentBody: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 11,
  },
  categoryBadge: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#64748B',
  },
  title: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: '#0F172A',
    lineHeight: 28,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#64748B',
  },
  infoValue: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: '#0F172A',
    marginTop: 2,
  },
  infoSubValue: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  joinLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  joinLinkText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
    color: '#2563EB',
    textDecorationLine: 'underline',
  },
  hostCard: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
    marginBottom: 20,
  },
  sectionHeading: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 10,
  },
  hostProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  hostAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInitial: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#E11D48',
  },
  hostTextGroup: {
    flex: 1,
  },
  hostName: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#0F172A',
  },
  hostDesignation: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#64748B',
  },
  hostBio: {
    marginTop: 8,
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  descSection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  bodyDescription: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  rsvpMainButton: {
    backgroundColor: '#FE6700',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  waitlistMainButton: {
    backgroundColor: '#D97706',
  },
  rsvpMainButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  confirmedActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmedStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  confirmedStatusText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#15803D',
  },
  cancelLinkButton: {
    padding: 8,
  },
  cancelLinkText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    color: '#EF4444',
  },
});

