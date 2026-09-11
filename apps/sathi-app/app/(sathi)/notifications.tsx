import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => Math.round((SCREEN_WIDTH / 390) * size);

const DEEP_ORANGE = '#FE6700';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${API_URL}/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
      }
    } catch (error) {
      console.log('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      // Optimistic update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));

      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.log('Error marking as read:', e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.log('Error marking all as read:', e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      // Optimistic update
      setNotifications(prev => prev.filter(n => n.id !== id));

      await fetch(`${API_URL}/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.log('Error deleting notification:', e);
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNotification(id),
        },
      ]
    );
  };

  const clearAllNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      setNotifications([]);

      await fetch(`${API_URL}/notifications/clear-all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.log('Error clearing all notifications:', e);
    }
  };

  const confirmClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: clearAllNotifications,
        },
      ]
    );
  };

  const getTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getIconForType = (type: string, category?: string) => {
    const key = (category || type || '').toLowerCase();
    if (key.includes('emergency') || key.includes('alert') || key.includes('urgent')) return 'alert-circle-outline';
    if (key.includes('matching') || key.includes('match') || key.includes('beneficiary')) return 'heart-outline';
    if (key.includes('hour') || key.includes('visit') || key.includes('checkout') || key.includes('checkin')) return 'time-outline';
    if (key.includes('credit') || key.includes('reward') || key.includes('badge')) return 'gift-outline';
    if (key.includes('support') || key.includes('guide') || key.includes('faq')) return 'help-circle-outline';
    if (key.includes('coordinator') || key.includes('feedback')) return 'chatbubble-ellipses-outline';
    if (key.includes('onboarding') || key.includes('profile') || key.includes('address') || key.includes('welcome') || key.includes('registration')) return 'checkmark-circle-outline';
    return 'notifications-outline';
  };

  const getIconColorForType = (type: string, category?: string) => {
    const key = (category || type || '').toLowerCase();
    if (key.includes('emergency') || key.includes('alert') || key.includes('urgent')) return '#EF4444'; // Red
    if (key.includes('matching') || key.includes('match') || key.includes('beneficiary')) return '#FE6700'; // Saathi Primary Orange
    if (key.includes('hour') || key.includes('visit')) return '#F97316'; // Warm Orange
    if (key.includes('credit') || key.includes('reward')) return '#FE6700'; // Saathi Orange
    if (key.includes('profile') || key.includes('onboarding') || key.includes('address') || key.includes('welcome') || key.includes('registration')) return '#FE6700'; // Saathi Orange
    if (key.includes('support') || key.includes('guide')) return '#06B6D4'; // Cyan
    if (key.includes('coordinator') || key.includes('feedback')) return '#F59E0B'; // Amber
    return '#FE6700'; // Default to Saathi Brand Orange
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderItem = ({ item }: { item: any }) => {
    const category = item.data?.category || item.category;
    const targetScreen = item.data?.screen || item.data?.targetScreen;
    const iconColor = getIconColorForType(item.type, category);

    return (
      <TouchableOpacity 
        style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
        activeOpacity={0.75}
        onPress={() => {
          if (!item.isRead) markAsRead(item.id);
          if (targetScreen) {
            try {
              router.push(targetScreen as any);
            } catch (e) {
              console.log('Error navigating from notification:', e);
            }
          }
        }}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '18' }]}>
          <Ionicons name={getIconForType(item.type, category) as any} size={22} color={iconColor} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !item.isRead && styles.unreadTitle]}>{item.title}</Text>
            {!item.isRead && <View style={styles.unreadDot} />}
            {targetScreen && (
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={styles.chevron} />
            )}
          </View>
          <Text style={styles.body}>{item.body}</Text>
          <View style={styles.footerRow}>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
              <Text style={styles.time}>{getTimeAgo(item.createdAt || item.sentAt)}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={(e) => {
                e.stopPropagation();
                confirmDelete(item.id);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.65}
            >
              <Ionicons name="trash-outline" size={13} color="#EF4444" />
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadCountBadge}>
              <Text style={styles.unreadCountText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead} activeOpacity={0.7}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity 
              style={styles.clearAllButton} 
              onPress={confirmClearAll} 
              activeOpacity={0.7}
              accessibilityLabel="Clear all notifications"
            >
              <Ionicons name="trash-outline" size={17} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={DEEP_ORANGE} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="notifications-off-outline" size={40} color={DEEP_ORANGE} />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>You're all caught up! We'll let you know when something important happens.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[DEEP_ORANGE]} tintColor={DEEP_ORANGE} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  unreadCountBadge: {
    backgroundColor: DEEP_ORANGE,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  clearAllButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markAllText: {
    fontSize: 14,
    color: DEEP_ORANGE,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#FFF9F5',
    borderColor: '#FED7AA',
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contentContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  chevron: {
    marginLeft: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  unreadTitle: {
    color: '#111827',
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DEEP_ORANGE,
    marginLeft: 6,
  },
  body: {
    fontSize: 13.5,
    color: '#6B7280',
    lineHeight: 19,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  deleteText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
