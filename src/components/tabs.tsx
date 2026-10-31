import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import type { IconName } from './ui';

/** hidden: the route exists but has no tab (e.g. the manager tab for staff who manage no store). */
export interface TabDef { name: string; title: string; icon: IconName; badge?: number; hidden?: boolean }

/** Bottom tab bar shared by the owner and staff apps. */
export function AppTabs({ tabs }: { tabs: TabDef[] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
      tabBarStyle: {
        backgroundColor: colors.surface, borderTopColor: colors.border,
        height: 62 + insets.bottom, paddingTop: 2, paddingBottom: insets.bottom + 2,
      },
      sceneStyle: { backgroundColor: colors.background },
    }}>
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.title,
          href: t.hidden ? null : undefined,
          tabBarBadge: t.badge ? t.badge : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={(focused ? t.icon.replace('-outline', '') : t.icon) as IconName} size={23} color={color} />
          ),
        }} />
      ))}
    </Tabs>
  );
}
