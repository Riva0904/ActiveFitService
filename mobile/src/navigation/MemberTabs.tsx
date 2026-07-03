import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

// Screens (will be populated in subsequent phases)
import MemberHomeScreen from '../screens/member/HomeScreen';
import AttendanceScreen from '../screens/member/AttendanceScreen';
import PlansScreen from '../screens/member/PlansScreen';
import StoreScreen from '../screens/member/StoreScreen';
import ProfileScreen from '../screens/member/ProfileScreen';

const Tab = createBottomTabNavigator();

const ORANGE = '#FF4D00';
const GRAY = '#9CA3AF';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠', Attendance: '📅', Plans: '💪', Store: '🛒', Profile: '👤',
  };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>;
}

export default function MemberTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: GRAY,
        tabBarStyle: { paddingBottom: 4, paddingTop: 4, height: 60 },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={MemberHomeScreen} />
      <Tab.Screen name="Attendance" component={AttendanceScreen} />
      <Tab.Screen name="Plans" component={PlansScreen} />
      <Tab.Screen name="Store" component={StoreScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
