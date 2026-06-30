import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/lib/AuthContext';

// Today is the home tab. Clock-in is reached by tapping a visit (or a shift
// notification), so it pushes over the tabs as a hidden route (href: null)
// rather than living in the bar.
export const unstable_settings = {
  initialRouteName: 'dashboard',
};

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // Wait for the session to finish hydrating before mounting ANY protected
  // screen, so a child doesn't fire an authenticated request before the bearer
  // token is attached on reload (which would 401 and bounce to login).
  if (isLoading) {
    return null;
  }
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a5fa8',
        tabBarInactiveTintColor: '#90a4b8',
        tabBarStyle: { borderTopWidth: 1, borderTopColor: '#e2eaf2', paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Visits',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
