// src/components/LanguageSwitcher.tsx
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../i18n';
import { useMemo } from "react";
import { useTheme, type Colors } from "../theme";
import { Text } from "./themed";

export default function LanguageSwitcher() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
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
const makeStyles = (c: Colors) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border },
  active: { backgroundColor: c.primarySoft, borderColor: c.primarySoftBorder },
  text: { fontWeight: '600' },
});
