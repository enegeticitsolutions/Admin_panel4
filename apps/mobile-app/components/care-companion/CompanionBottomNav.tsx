import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEEP_ORANGE = '#FE6700';

export function CompanionBottomNav() {
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    const isActive = (route: string) => {
        if (route === '/' && pathname === '/') return true;
        if (route !== '/' && pathname.includes(route)) return true;
        return false;
    };

    return (
        <View style={[styles.bottomTabBar, {
            height: (Platform.OS === 'ios' ? 85 : 70) + (Platform.OS === 'android' ? insets.bottom : 0),
            paddingBottom: (Platform.OS === 'ios' ? 20 : 0) + (Platform.OS === 'android' ? insets.bottom : 0)
        }]}>
            <View style={styles.tabContainer}>
                {/* Home Tab */}
                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => router.replace('/(care-companion)')}
                >
                    <Ionicons name={isActive('/') ? "home" : "home-outline"} size={24} color={isActive('/') ? DEEP_ORANGE : '#9CA3AF'} />
                    <Text style={[styles.tabText, isActive('/') && { color: DEEP_ORANGE }]}>Home</Text>
                </TouchableOpacity>

                {/* Schedule Tab */}
                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => router.replace('/(care-companion)/schedule')}
                >
                    <Ionicons name={isActive('schedule') ? "calendar" : "calendar-outline"} size={24} color={isActive('schedule') ? DEEP_ORANGE : '#9CA3AF'} />
                    <Text style={[styles.tabText, isActive('schedule') && { color: DEEP_ORANGE }]}>Schedule</Text>
                </TouchableOpacity>

                {/* History Tab */}
                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => router.replace('/(care-companion)/history')}
                >
                    <Ionicons name={isActive('history') ? "pulse" : "pulse-outline"} size={24} color={isActive('history') ? DEEP_ORANGE : '#9CA3AF'} />
                    <Text style={[styles.tabText, isActive('history') && { color: DEEP_ORANGE }]}>History</Text>
                </TouchableOpacity>

                {/* Profile Tab */}
                <TouchableOpacity
                    style={styles.tabItem}
                    onPress={() => router.replace('/(care-companion)/profile')}
                >
                    <Ionicons name={isActive('profile') ? "person" : "person-outline"} size={24} color={isActive('profile') ? DEEP_ORANGE : '#9CA3AF'} />
                    <Text style={[styles.tabText, isActive('profile') && { color: DEEP_ORANGE }]}>Profile</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    bottomTabBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: Platform.OS === 'ios' ? 85 : 70,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
        zIndex: 100,
    },
    tabContainer: {
        flexDirection: 'row',
        width: '100%',
        maxWidth: 440,
        height: '100%',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    tabItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%' },
    tabText: {
        fontSize: 11,
        marginTop: 4,
        fontFamily: 'Poppins_600SemiBold',
        color: '#9CA3AF',
    },
});
