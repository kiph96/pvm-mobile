import { Redirect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Loading } from '@/components/ui';
import { useSession } from '@/state/session';

/** Routes the user to the right place: sign-in → pick a business → owner or staff app. */
export default function Index() {
  const { ready, session, isManager } = useSession();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><Loading /></View>;
  if (!session) return <Redirect href="/sign-in" />;
  if (!session.workspace) return <Redirect href="/workspace" />;
  return <Redirect href={isManager ? '/owner' : '/staff'} />;
}
