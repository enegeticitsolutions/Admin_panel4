import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SelectedBeneficiaryProvider } from '@/contexts/SelectedBeneficiaryContext';

const visibleTabs = ['index', 'schedule', 'meds', 'community', 'more'];

export default function BeneficiaryLayout() {
    const insets = useSafeAreaInsets();

    return (
        <SelectedBeneficiaryProvider>
        <Tabs
            backBehavior="history"
            screenOptions={({ route }) => {
                const showInTabBar = visibleTabs.includes(route.name);

                return {
                    headerShown: false,
                    tabBarActiveTintColor: '#FE6700',
                    tabBarInactiveTintColor: '#68707D',
                    tabBarButton: showInTabBar ? undefined : () => null,
                    tabBarItemStyle: showInTabBar ? undefined : { display: 'none' },
                    tabBarStyle: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderTopWidth: 1.08,
                        borderTopColor: '#E7DED6',
                        height: Platform.OS === 'ios' ? 88 : Platform.OS === 'web' ? 68 : 60 + insets.bottom,
                        paddingBottom: Platform.OS === 'ios' ? 32 : Platform.OS === 'web' ? 8 : 8 + insets.bottom,
                        paddingTop: Platform.OS === 'web' ? 8 : 8,
                        elevation: 0,
                        shadowColor: '#000000',
                        shadowOpacity: 0.04,
                        shadowOffset: { width: 0, height: -2 },
                        shadowRadius: 4,
                        width: '100%',
                    },
                    tabBarLabelStyle: {
                        fontFamily: 'Poppins-Medium',
                        fontSize: 12,
                        fontWeight: '500',
                    },
                    tabBarIconStyle: {
                        marginBottom: 0,
                    },
                };
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ color }) => (
                        <Feather name="home" size={24} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="schedule"
                options={{
                    title: 'Schedule',
                    tabBarLabel: 'Schedule',
                    tabBarIcon: ({ color }) => (
                        <Feather name="calendar" size={24} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="meds"
                options={{
                    title: 'Health',
                    tabBarLabel: 'Health',
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="pill" size={24} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="community"
                options={{
                    title: 'Community',
                    tabBarLabel: 'Community',
                    tabBarIcon: ({ color }) => (
                        <Feather name="users" size={24} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="inbox"
                options={{
                    title: 'Inbox',
                    tabBarLabel: 'Inbox',
                    tabBarIcon: ({ color }) => (
                        <Feather name="inbox" size={24} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="more"
                options={{
                    title: 'More',
                    tabBarLabel: 'More',
                    tabBarIcon: ({ color }) => (
                        <Feather name="more-horizontal" size={24} color={color} />
                    ),
                }}
            />
        </Tabs>
        </SelectedBeneficiaryProvider>
    );
}