// App.tsx (updated)
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, type Theme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './src/screens/HomeScreen';
import FeedingScreen from './src/screens/FeedingScreen';
import WeightScreen from './src/screens/WeightScreen';
import BathsScreen from './src/screens/BathsScreen';
import WalkScreen from './src/screens/WalkScreen';
import { PetProvider, usePet } from './src/context/PetContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RemindersProvider } from './src/context/RemindersContext';
import { CareProvider } from './src/context/CareContext';
import CareScreen from './src/screens/CareScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PetGate from './src/screens/PetGate';
import { useTranslation } from 'react-i18next';
import './src/i18n';           // ensure module is loaded
import { initI18n } from './src/i18n';
import { useMemo } from "react";
import { useTheme, type Colors } from "./src/theme";
import { Text } from "./src/components/themed";
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import PushSync from './src/context/PushSync';
import WidgetSync from './src/context/WidgetSync';
import { ToastProvider } from './src/components/Toast';

function useNavigationTheme(): Theme {
  const c = useTheme();
  const base = c.isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: c.bg,
      text: c.text,
      primary: c.primary,
      card: c.bg,
      border: c.border,
      notification: c.primary,
    },
  };
}

// Content scrolls under the clock and battery; a solid strip the height of the status bar
// keeps it from ever showing through behind them.
function StatusBarScrim() {
  const c = useTheme();
  const { top } = useSafeAreaInsets();
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top, backgroundColor: c.bg }} />;
}

function ThemedNavigation({ children }: { children: React.ReactNode }) {
  const theme = useNavigationTheme();
  return (
    <NavigationContainer theme={theme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {children}
      <StatusBarScrim />
    </NavigationContainer>
  );
}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AppTabs() {
  const [ready, setReady] = useState(false);
  const { t } = useTranslation();
  const c = useTheme();

   useEffect(() => {
    (async () => {
      await initI18n(); // sets saved/device language (defaults to nb)
      setReady(true);
    })();
  }, []);

  if (!ready) return null;



  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // No header bar: each page opens with its own large title, and the tab bar names the page.
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
        tabBarLabel:
          route.name === 'Home'    ? t('tabs_home')   :
          route.name === 'Feeding' ? t('tabs_feeding'):
          route.name === 'Walk'    ? t('tabs_walk')   :
          route.name === 'Weight'  ? t('tabs_weight') :
          route.name === 'Bath'    ? t('tabs_bath')   :
          route.name === 'Care'    ? t('tabs_care')   :
           t('tabs_profile'),
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          if (route.name === 'Feeding') iconName = focused ? 'restaurant' : 'restaurant-outline';
          if (route.name === 'Walk') iconName = focused ? 'walk' : 'walk-outline';
          if (route.name === 'Weight') iconName = focused ? 'scale' : 'scale-outline';
          if (route.name === 'Bath') iconName = focused ? 'water' : 'water-outline';
          if (route.name === 'Care') iconName = focused ? 'heart' : 'heart-outline';
          if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Feeding" component={FeedingScreen} />
      <Tab.Screen name="Walk" component={WalkScreen} />
      <Tab.Screen name="Weight" component={WeightScreen} />
      <Tab.Screen name="Bath" component={BathsScreen} />
      <Tab.Screen name="Care" component={CareScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} /> 
    </Tab.Navigator>
  );
}

// Signed in, but a dog is needed first: PetGate shows loading, an error, or onboarding.
function GatedTabs() {
  return (
    <PetGate>
      <AppTabs />
    </PetGate>
  );
}

function RootNavigator() {
  const { token, isBootstrapping } = useAuth();
  const { t } = useTranslation();

  if (isBootstrapping) {
    // splash/loader placeholder
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="paw" size={28} />
        <Text style={{ marginTop: 8 }}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <Stack.Screen name="AppTabs" component={GatedTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <PetProvider>
            <PushSync />
            <WidgetSync />
            <CareProvider>
              <RemindersProvider>
                <ThemedNavigation>
                  <RootNavigator />
                </ThemedNavigation>
              </RemindersProvider>
            </CareProvider>
          </PetProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
