import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import TrainerHomeScreen from '../screens/trainer/HomeScreen';
import TrainerMembersScreen from '../screens/trainer/MembersScreen';
import TrainerSessionsScreen from '../screens/trainer/SessionsScreen';
import TrainerAttendanceScreen from '../screens/trainer/AttendanceScreen';
import ProfileScreen from '../screens/member/ProfileScreen';

const Tab = createBottomTabNavigator();

const ORANGE = '#FF4D00';
const GRAY = '#9CA3AF';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠', Members: '👥', Sessions: '🏋️', Attendance: '📅', Profile: '👤',
  };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>;
}

export default function TrainerTabs() {
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
      <Tab.Screen name="Home" component={TrainerHomeScreen} />
      <Tab.Screen name="Members" component={TrainerMembersScreen} />
      <Tab.Screen name="Sessions" component={TrainerSessionsScreen} />
      <Tab.Screen name="Attendance" component={TrainerAttendanceScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
