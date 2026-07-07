import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/lib/AuthContext';
import LoadingScreen from '../../src/features/common/LoadingScreen';
import { colors } from '../../src/features/common/tokens';

// Today is the home tab. Clock-in is reached by tapping a visit (or a shift
// notification), so it pushes over the tabs as a hidden route (href: null)
// rather than living in the bar.
export const unstable_settings = {
  initialRouteName: 'dashboard',
};

export default function AppLayout() {
  const { isAuthenticated, isLoading, needsAgencySelection } = useAuth();

  // Wait for the session to finish hydrating before mounting ANY protected
  // screen, so a child doesn't fire an authenticated request before the bearer
  // token is attached on reload (which would 401 and bounce to login).
  if (isLoading) {
    return <LoadingScreen />;
  }
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }
  // A multi-agency account fresh off sign-in must pick its agency before any
  // agency-scoped tab renders, everything below this gate shows PHI that
  // belongs to exactly one agency.
  if (needsAgencySelection) {
    return <Redirect href="/select-agency" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandBlue,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
      screenListeners={{ tabPress: () => { void Haptics.selectionAsync(); } }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'today' : 'today-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Visits',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'checkbox' : 'checkbox-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
