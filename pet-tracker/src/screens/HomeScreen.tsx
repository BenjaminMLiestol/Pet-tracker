import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePet } from '../context/PetContext';

export default function HomeScreen() {
  const { name, hasFedToday, lastBathAt, currentWeightKg } = usePet();

  const lastBathText = lastBathAt
    ? `${lastBathAt.toLocaleDateString()} (${formatRelativeDays(lastBathAt)})`
    : 'No bath recorded';

  const weightText = currentWeightKg != null ? `${currentWeightKg.toFixed(1)} kg` : 'No weight recorded';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hi, {name}!</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today</Text>
        <Text style={styles.row}><Text style={styles.label}>Fed: </Text>{hasFedToday ? 'Yes' : 'No'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Grooming</Text>
        <Text style={styles.row}><Text style={styles.label}>Last bath: </Text>{lastBathText}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health</Text>
        <Text style={styles.row}><Text style={styles.label}>Current weight: </Text>{weightText}</Text>
      </View>
    </View>
  );
}

function formatRelativeDays(date: Date): string {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / msPerDay);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    fontSize: 16,
    marginBottom: 4,
  },
  label: {
    color: '#374151',
    fontWeight: '600',
  },
});
