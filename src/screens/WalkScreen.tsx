import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Switch, FlatList } from 'react-native';
import { usePet } from '../context/PetContext';

export default function WalkScreen() {
  const { name, walks, hasWalkedToday, setWalkedToday } = usePet();

  const sorted = useMemo(
    () => [...walks].sort((a, b) => b.timestamp - a.timestamp),
    [walks]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Walk</Text>
      <View style={styles.card}>
        <Text style={styles.row}><Text style={styles.label}>Walked today</Text></Text>
        <View style={styles.switchRow}>
          <Text style={styles.nameText}>{name}</Text>
          <Switch value={hasWalkedToday} onValueChange={setWalkedToday} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>History</Text>
        <FlatList
          data={sorted}
          keyExtractor={(item, index) => String(item.id ?? `${item.timestamp}-${index}`)}
          renderItem={({ item }) => (
            <View style={styles.listRow}>
              <Text style={styles.listRowTitle}>{new Date(item.timestamp).toLocaleString()}</Text>
              <Text style={[styles.badge, item.walked ? styles.badgeGood : styles.badgeBad]}>
                {item.walked ? 'Walked' : 'Skipped'}
              </Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameText: {
    fontSize: 16,
    color: '#111827',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  listRowTitle: {
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    color: 'white',
    fontWeight: '700',
    minWidth: 70,
    textAlign: 'center',
  },
  badgeGood: {
    backgroundColor: '#10b981',
  },
  badgeBad: {
    backgroundColor: '#ef4444',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
});
