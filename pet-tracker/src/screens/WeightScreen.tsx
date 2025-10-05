import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { usePet } from '../context/PetContext';

export default function WeightScreen() {
  const { currentWeightKg, weights, setWeightToday } = usePet();
  const [input, setInput] = useState('');
  const inputRef = useRef<TextInput>(null);

  const sorted = useMemo(
    () => [...weights].sort((a, b) => b.timestamp - a.timestamp),
    [weights]
  );

  const onSave = () => {
    const normalized = input.replace(',', '.');
    const val = Number(normalized);
    if (!Number.isFinite(val) || val <= 0) return;
    setWeightToday(val);
    setInput('');
    // Ensure input loses focus and keyboard is dismissed
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  const maxWeight = Math.max(...sorted.map((w) => w.weightKg), 1);
  const minWeight = Math.min(...sorted.map((w) => w.weightKg), 0);
  const range = Math.max(1, maxWeight - minWeight);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
      <Text style={styles.title}>Weight</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current</Text>
        <Text style={styles.row}><Text style={styles.label}>Weight: </Text>{currentWeightKg != null ? `${currentWeightKg.toFixed(1)} kg` : 'No weight recorded'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Log today (optional)</Text>
        <View style={styles.formRow}>
          <TextInput
            placeholder="e.g. 19.3"
            value={input}
            onChangeText={setInput}
            keyboardType="numeric"
            style={styles.input}
            ref={inputRef}
            blurOnSubmit
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
          <Button title="Save" onPress={onSave} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>History</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBars}>
            {sorted.length === 0 ? (
              <Text style={styles.helperText}>No data yet</Text>
            ) : (
              sorted.slice(0, 10).map((w, idx) => {
                const relative = (w.weightKg - minWeight) / range;
                const height = 16 + Math.round(relative * 84); // 16-100 px
                return (
                  <View key={`${w.timestamp}-${idx}`} style={styles.barWrapper}>
                    <View style={[styles.bar, { height }]} />
                    <Text style={styles.barLabel}>{w.weightKg.toFixed(1)}</Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>
      </View>
    </TouchableWithoutFeedback>
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
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: 'white',
  },
  chartContainer: {
    height: 140,
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barWrapper: {
    width: 36,
    alignItems: 'center',
    marginRight: 8,
  },
  bar: {
    width: 26,
    backgroundColor: '#34d399',
    borderRadius: 6,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 12,
    color: '#111827',
  },
  helperText: {
    color: '#6b7280',
  },
});
