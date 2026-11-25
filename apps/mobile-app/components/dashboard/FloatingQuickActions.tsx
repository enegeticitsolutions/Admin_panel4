import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { HomeColors, HomeShadows } from '@/constants/homeTheme';

interface FloatingQuickActionsProps {
  onBookSaathi: () => void;
  onBookCareMitra: () => void;
  onAddMedicine: () => void;
  onLogVitals: () => void;
  onJoinCircle?: () => void;
}

export function FloatingQuickActions({
  onBookSaathi,
  onBookCareMitra,
  onAddMedicine,
  onLogVitals,
  onJoinCircle,
}: FloatingQuickActionsProps) {
  return (
    <View style={styles.floatingContainer}>
      {/* 1. Book Saathi */}
      <TouchableOpacity
        style={styles.actionItem}
        onPress={onBookSaathi}
        activeOpacity={0.75}
      >
        <View style={[styles.iconBox, { backgroundColor: HomeColors.peachBg }]}>
          <MaterialCommunityIcons name="account-heart-outline" size={20} color={HomeColors.brandOrange} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={2}>
          Book Saathi
        </Text>
      </TouchableOpacity>

      {/* 2. Book Care Mitra */}
      <TouchableOpacity
        style={styles.actionItem}
        onPress={onBookCareMitra}
        activeOpacity={0.75}
      >
        <View style={[styles.iconBox, { backgroundColor: HomeColors.blueBg }]}>
          <Feather name="user-check" size={19} color={HomeColors.blueIcon} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={2}>
          Book Care Mitra
        </Text>
      </TouchableOpacity>

      {/* 3. Med & Health */}
      <TouchableOpacity
        style={styles.actionItem}
        onPress={onAddMedicine}
        activeOpacity={0.75}
      >
        <View style={[styles.iconBox, { backgroundColor: HomeColors.yellowBg }]}>
          <MaterialCommunityIcons name="pill" size={20} color={HomeColors.yellowIcon} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={2}>
          Med & Health
        </Text>
      </TouchableOpacity>

      {/* 4. My Vitals */}
      <TouchableOpacity
        style={styles.actionItem}
        onPress={onLogVitals}
        activeOpacity={0.75}
      >
        <View style={[styles.iconBox, { backgroundColor: HomeColors.mintBg }]}>
          <Feather name="activity" size={19} color={HomeColors.mintIcon} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={2}>
          My Vitals
        </Text>
      </TouchableOpacity>

      {/* Join Circle (commented out per request — kept in code for future use)
      <TouchableOpacity
        style={styles.actionItem}
        onPress={onJoinCircle}
        activeOpacity={0.75}
      >
        <View style={[styles.iconBox, { backgroundColor: HomeColors.blueBg }]}>
          <Feather name="users" size={19} color={HomeColors.blueIcon} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={2}>
          Join circle
        </Text>
      </TouchableOpacity>
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: HomeColors.cardWhite,
    borderRadius: 24,
    borderWidth: 1.08,
    borderColor: HomeColors.borderLight,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginTop: -22,
    marginBottom: 16,
    zIndex: 2,
    ...HomeShadows.floatingBar,
  },
  actionItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 14,
    color: HomeColors.textSecondary,
    textAlign: 'center',
  },
});
