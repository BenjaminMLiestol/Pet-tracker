import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { usePet } from '../context/PetContext';

export default function BathsScreen() {
  const { baths, nextBathDueAt, isBathDueToday, setBathedToday } = usePet();

  const sorted = useMemo(
    () => [...baths].sort((a, b) => b.timestamp - a.timestamp),
    [baths]
  );

  const intervalsDays = useMemo(() => {
    const days: number[] = [];
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const a = sorted[i].timestamp;
      const b = sorted[i + 1].timestamp;
      const diffDays = Math.max(1, Math.round((a - b) / (1000 * 60 * 60 * 24)));
      days.push(diffDays);
    }
    return days.slice(0, 8); // show up to 8 intervals
  }, [sorted]);

  const maxInterval = Math.max(1, ...intervalsDays);

  const nextBathText = nextBathDueAt
    ? nextBathDueAt.toLocaleDateString()
    : 'Not scheduled';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Baths</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next schedule</Text>
        <Text style={styles.row}><Text style={styles.label}>Due: </Text>{nextBathText}</Text>
        {isBathDueToday ? (
          <Button title="Mark bathed today" onPress={setBathedToday} />
        ) : (
          <Text style={styles.helperText}>Monthly schedule (every ~30 days)</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>History (days between baths)</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBars}>
            {intervalsDays.length === 0 ? (
              <Text style={styles.helperText}>Not enough data to chart yet</Text>
            ) : (
              intervalsDays.map((d, idx) => {
                const height = 16 + Math.round((d / maxInterval) * 84); // 16-100 px
                return (
                  <View key={`${d}-${idx}`} style={styles.barWrapper}>
                    <View style={[styles.bar, { height }]} />
                    <Text style={styles.barLabel}>{d}d</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>
    </View>
  );
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
    marginBottom: 8,
  },
  label: {
    color: '#374151',
    fontWeight: '600',
  },
  helperText: {
    color: '#6b7280',
    marginTop: 8,
  },
  chartContainer: {
    height: 120,
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barWrapper: {
    width: 28,
    alignItems: 'center',
    marginRight: 8,
  },
  bar: {
    width: 20,
    backgroundColor: '#60a5fa',
    borderRadius: 6,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 12,
    color: '#111827',
  },
});
