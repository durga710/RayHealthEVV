import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/lib/AuthContext';

const PRIMARY = '#1a5fa8';
const INACTIVE = '#9ab0c8';

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // Auth gate for the whole tab area. If the session is lost at any point
  // (token rejected, logout, expiry mid-use), bounce straight to login rather
  // than leaving the user on a protected screen they can't load data into.
  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e8edf2',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 8 : 4,
          height: Platform.OS === 'ios' ? 84 : 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clockin"
        options={{
          title: 'Clock In/Out',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
