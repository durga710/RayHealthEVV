import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/AuthContext';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }
  
  return <Redirect href="/(tabs)/dashboard" />;
}
