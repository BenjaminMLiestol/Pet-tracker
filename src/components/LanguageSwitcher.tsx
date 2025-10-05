// src/components/LanguageSwitcher.tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../i18n';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.btn, current === 'nb' && styles.active]}
        onPress={() => setAppLanguage('nb')}
      >
        <Text style={styles.text}>Norsk (Bokmål)</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, current === 'en' && styles.active]}
        onPress={() => setAppLanguage('en')}
      >
        <Text style={styles.text}>English</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  active: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  text: { fontWeight: '600' },
});
