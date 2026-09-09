import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const visibleTabs = ['index', 'schedule', 'meds', 'inbox', 'more'];

export default function BeneficiaryLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={({ route }) => {
                const showInTabBar = visibleTabs.includes(route.name);

                return {
                    headerShown: false,
                    tabBarActiveTintColor: '#FF6A00',
                    tabBarInactiveTintColor: '#6B7280',
                    tabBarButton: showInTabBar ? undefined : () => null,
                    tabBarItemStyle: showInTabBar ? undefined : { display: 'none' },
                    tabBarStyle: {
                        backgroundColor: '#FFFFFF',
                        borderTopWidth: 1,
                        borderTopColor: '#E5E7EB',
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
                    title: 'Meds',
                    tabBarLabel: 'Meds',
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="pill" size={24} color={color} />
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
    );
}