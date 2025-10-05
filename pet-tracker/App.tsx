import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './src/screens/HomeScreen';
import FeedingScreen from './src/screens/FeedingScreen';
import WeightScreen from './src/screens/WeightScreen';
import BathsScreen from './src/screens/BathsScreen';
import WalkScreen from './src/screens/WalkScreen';
import { PetProvider, usePet } from './src/context/PetContext';

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
    <PetProvider>
      <NavigationContainer theme={LightTheme}>
        <StatusBar style="dark" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerTitle: () => <HeaderTitle />,
            headerTitleAlign: 'center',
            tabBarActiveTintColor: '#2563eb',
            tabBarInactiveTintColor: '#6b7280',
            tabBarIcon: ({ color, size, focused }) => {
              let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
              if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
              if (route.name === 'Feeding') iconName = focused ? 'fast-food' : 'fast-food-outline';
              if (route.name === 'Walk') iconName = focused ? 'walk' : 'walk-outline';
              if (route.name === 'Weight') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              if (route.name === 'Bath') iconName = focused ? 'water' : 'water-outline';
              return <Ionicons name={iconName} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Feeding" component={FeedingScreen} />
          <Tab.Screen name="Walk" component={WalkScreen} />
          <Tab.Screen name="Weight" component={WeightScreen} />
          <Tab.Screen name="Bath" component={BathsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </PetProvider>
  );
}

function HeaderTitle() {
  const { name } = usePet();
  return (
    <View style={styles.headerTitleContainer}>
      <Ionicons name="paw" size={22} color="#111" style={styles.headerIcon} />
      <Text style={styles.headerTitleText}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
