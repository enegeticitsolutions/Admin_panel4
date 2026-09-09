import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { addNotificationReceivedListener } from '@/services/notifications';
import { API_URL } from '@/constants/api';

interface NotificationBellProps {
  style?: any;
  iconColor?: string;
}

export default function NotificationBell({ style, iconColor = '#111827' }: NotificationBellProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/shared/users/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.data) {
        const count = data.data.filter((n: any) => !n.isRead).length;
        setUnreadCount(count);
      }
    } catch (err) {
      console.warn('Error fetching notifications count:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchUnreadCount();
    }, [])
  );

  useEffect(() => {
    const subscription = addNotificationReceivedListener(() => {
      fetchUnreadCount();
    });
    return () => subscription.remove();
  }, []);

  const handlePress = async () => {
    try {
      const userStr = await AsyncStorage.getItem('userData');
      const user = userStr ? JSON.parse(userStr) : null;
      const role = (user?.role || '').toUpperCase();

      if (role === 'SUBSCRIBER' || pathname.includes('subscriber')) {
        router.push('/(subscriber)/inbox');
      } else if (role === 'BENEFICIARY' || pathname.includes('beneficiary')) {
        router.push('/(beneficiary)/inbox');
      } else {
        router.push('/notifications');
      }
    } catch {
      if (pathname.includes('subscriber')) {
        router.push('/(subscriber)/inbox');
      } else {
        router.push('/(beneficiary)/inbox');
      }
    }
  };

  return (
    <TouchableOpacity style={[styles.container, style]} onPress={handlePress} activeOpacity={0.7}>
      <Ionicons name="notifications-outline" size={24} color={iconColor} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
