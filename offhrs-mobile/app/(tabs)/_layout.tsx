import { Tabs } from 'expo-router';
import React from 'react';
import { Image, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';

const TAB_ICON_SIZE = 50;

const TAB_ICON_TOP_OFFSET = 12;

function TabIcon({
  source,
  focused,
}: {
  source: number;
  focused: boolean;
}) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: TAB_ICON_TOP_OFFSET }}>
      <Image
        source={source}
        style={{ width: TAB_ICON_SIZE, height: TAB_ICON_SIZE, opacity: focused ? 1 : 0.6 }}
        resizeMode="contain"
      />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#FFFFFF' },
        tabBarActiveTintColor: '#38511B',
        tabBarInactiveTintColor: '#5E5F56',
        headerShown: false,
        tabBarShowLabel: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon source={require('@/assets/images/Home.png')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="workshops"
        options={{
          title: 'Workshops',
          tabBarIcon: ({ focused }) => (
            <TabIcon source={require('@/assets/images/Workshop.png')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="contact"
        options={{
          title: 'Contact',
          tabBarIcon: ({ focused }) => (
            <TabIcon source={require('@/assets/images/Contact.png')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon source={require('@/assets/images/Profile.png')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
