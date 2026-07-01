import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/AuthContext';
import LoadingScreen from '../src/features/common/LoadingScreen';

export default function Index() {
  const { isAuthenticated, isLoading, needsAgencySelection } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (needsAgencySelection) {
    return <Redirect href="/select-agency" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
