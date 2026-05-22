import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { colors, typography } from '@/theme/tokens';

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const tabLabelSize = isDesktop ? typography.small * 1.25 : typography.small;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarActiveTintColor: colors.accentTo,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: isDesktop ? 56 : 49,
        },
        tabBarLabelStyle: {
          fontSize: tabLabelSize,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '吐き出し',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={isDesktop ? size * 1.2 : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: '今日',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today" size={isDesktop ? size * 1.2 : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: '褒めログ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={isDesktop ? size * 1.2 : size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
