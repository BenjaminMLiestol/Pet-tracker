import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function BathsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Baths</Text>
      <Text>Track baths and schedule.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
});
