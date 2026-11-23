import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HomeColors, HomeShadows } from '@/constants/homeTheme';
import NotificationBell from '@/components/shared/NotificationBell';

interface HomeHeaderProps {
  greeting: string;
  userName: string;
  userPhoto?: string | null;
  onSosPress: () => void;
  triggeringSos?: boolean;
}

export function HomeHeader({
  greeting,
  userName,
  userPhoto,
  onSosPress,
  triggeringSos = false,
}: HomeHeaderProps) {
  const initial = (userName?.trim()?.[0] || 'M').toUpperCase();

  return (
    <View style={styles.header}>
      {/* Left: Avatar & Greeting */}
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>{initial}</Text>
          )}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.greetingText}>{greeting}</Text>
          <Text style={styles.userNameText} numberOfLines={1}>
            {userName}
          </Text>
        </View>
      </View>

      {/* Right: SOS & Notification Bell */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={[styles.sosButton, triggeringSos && { opacity: 0.8 }]}
          onPress={onSosPress}
          activeOpacity={0.85}
          disabled={triggeringSos}
        >
          <Ionicons name="radio-outline" size={18} color="#FFFFFF" style={styles.sosIcon} />
          <Text style={styles.sosText}>SOS</Text>
        </TouchableOpacity>

        <View style={styles.bellWrapper}>
          <NotificationBell iconColor="#374151" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(250, 243, 235, 0.95)',
    borderBottomWidth: 1.08,
    borderBottomColor: HomeColors.borderSubtle,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    backgroundColor: HomeColors.brandOrange,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: HomeColors.brandOrange,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 4,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 28,
  },
  textContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  greetingText: {
    fontFamily: 'Poppins-Medium',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
    color: HomeColors.textMuted,
  },
  userNameText: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    color: HomeColors.textPrimary,
  },
  actionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    height: 44,
    backgroundColor: HomeColors.sosRed,
    borderRadius: 36,
    ...HomeShadows.sos,
  },
  sosIcon: {
    marginRight: 6,
  },
  sosText: {
    fontFamily: 'Poppins-Bold',
    fontWeight: '700',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bellWrapper: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    borderWidth: 1.08,
    borderColor: HomeColors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
