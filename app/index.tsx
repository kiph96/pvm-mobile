import { Redirect } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Loading } from '@/components/ui';
import { usePrivacy } from '@/state/queries';
import { useSession } from '@/state/session';

/** Routes the user to the right place: sign-in → privacy consent → pick where to work → owner or staff app. */
export default function Index() {
  const { ready, session, isManager } = useSession();
  const privacy = usePrivacy();
  if (!ready || (session && privacy.isLoading)) return <View style={{ flex: 1, justifyContent: 'center' }}><Loading /></View>;
  if (!session) return <Redirect href="/sign-in" />;
  // a server without the consent endpoint (error) does not lock people out
  if (privacy.data?.accepted === false) return <Redirect href="/consent" />;
  if (!session.workspace) return <Redirect href="/workspace" />;
  return <Redirect href={isManager ? '/owner' : '/staff'} />;
}
