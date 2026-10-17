// App.tsx (updated)
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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
import { useTranslation } from 'react-i18next';
import './src/i18n';           // ensure module is loaded
import { initI18n } from './src/i18n';
import { useMemo } from "react";
import { useTheme, type Colors } from "./src/theme";
import { Text } from "./src/components/themed";

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

function ThemedNavigation({ children }: { children: React.ReactNode }) {
  const theme = useNavigationTheme();
  return (
    <NavigationContainer theme={theme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {children}
    </NavigationContainer>
  );
}

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AppTabs() {
  const [ready, setReady] = useState(false);
  const { logout } = useAuth();
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
        headerTitle: () => <HeaderTitle />,
        headerTitleAlign: 'center',
        headerRight: () => (
          <Pressable
            onPress={logout}
            style={{ paddingRight: 16 }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('logout')}
          >
            <Ionicons name="log-out-outline" size={20} color={c.text} />
          </Pressable>
        ),
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
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
          if (route.name === 'Feeding') iconName = focused ? 'fast-food' : 'fast-food-outline';
          if (route.name === 'Walk') iconName = focused ? 'walk' : 'walk-outline';
          if (route.name === 'Weight') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          if (route.name === 'Bath') iconName = focused ? 'water' : 'water-outline';
          if (route.name === 'Care') iconName = focused ? 'medkit' : 'medkit-outline';
          if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
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
        <Stack.Screen name="AppTabs" component={AppTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PetProvider>
        <RemindersProvider>
          <CareProvider>
            <ThemedNavigation>
              <RootNavigator />
            </ThemedNavigation>
          </CareProvider>
        </RemindersProvider>
      </PetProvider>
    </AuthProvider>
  );
}

function HeaderTitle() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
  const { name } = usePet();
  return (
    <View style={styles.headerTitleContainer}>
      <Ionicons name="paw" size={22} color={c.text} style={styles.headerIcon} />
      <Text style={styles.headerTitleText}>{name}</Text>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { marginRight: 8 },
  headerTitleText: { fontSize: 18, fontWeight: '700' },
});
