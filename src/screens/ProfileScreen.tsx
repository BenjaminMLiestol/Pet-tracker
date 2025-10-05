import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePet } from '../context/PetContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { name: petName, breed, currentWeightKg, lastBathAt } = usePet();

  const fullName = user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : '';

  const weightText = currentWeightKg != null ? `${currentWeightKg.toFixed(1)} kg` : '—';

  const formatter = new Intl.DateTimeFormat(i18n.language === 'nb' ? 'nb-NO' : 'en-US');
  const lastBathText = lastBathAt ? formatter.format(lastBathAt) : '—';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile_title')}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('account')}</Text>
        <Text style={styles.row}>
          <Text style={styles.label}>{t('name')}: </Text>{fullName || '—'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>{t('email')}: </Text>{user?.email ?? '—'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('pet')}</Text>
        <Text style={styles.row}>
          <Text style={styles.label}>{t('name')}: </Text>{petName || '—'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>{t('breed')}: </Text>{breed || '—'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>{t('current_weight_short')}: </Text>{weightText}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>{t('last_bath_short')}: </Text>{lastBathText}
        </Text>
      </View>

      {/* Language card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('language')}</Text>
        <LanguageSwitcher />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'stretch', padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  card: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { fontSize: 16, marginBottom: 6 },
  label: { color: '#374151', fontWeight: '600' },
});
