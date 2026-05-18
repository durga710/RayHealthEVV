import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="clockin"
        options={{
          title: 'Clock In/Out',
        }}
      />
    </Tabs>
  );
}
