import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from './src/screens/HomeScreen';
import FeedingScreen from './src/screens/FeedingScreen';
import WeightScreen from './src/screens/WeightScreen';
import BathsScreen from './src/screens/BathsScreen';

const LightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#ffffff',
    text: '#111111',
    primary: '#2563eb',
    card: '#ffffff',
    border: '#e5e7eb',
    notification: '#2563eb',
  },
};

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer theme={LightTheme}>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          headerTitleAlign: 'center',
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: '#6b7280',
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Feeding" component={FeedingScreen} />
        <Tab.Screen name="Weight" component={WeightScreen} />
        <Tab.Screen name="Baths" component={BathsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
