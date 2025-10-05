import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { usePet } from '../context/PetContext';

export default function ProfileScreen() {
  const { user } = useAuth();
  const { name: petName, breed, currentWeightKg, lastBathAt } = usePet();

  const fullName =
    user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : '';

  const weightText =
    currentWeightKg != null ? `${currentWeightKg.toFixed(1)} kg` : '—';

  const lastBathText = lastBathAt
    ? `${lastBathAt.toLocaleDateString()}`
    : '—';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Name: </Text>{fullName || '—'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Email: </Text>{user?.email ?? '—'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pet</Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Name: </Text>{petName || '—'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Breed: </Text>{breed || '—'}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Current weight: </Text>{weightText}
        </Text>
        <Text style={styles.row}>
          <Text style={styles.label}>Last bath: </Text>{lastBathText}
        </Text>
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
