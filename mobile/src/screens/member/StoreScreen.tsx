import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function StoreScreen() {
  const { data: supplements, isLoading } = useQuery({
    queryKey: ['supplements'],
    queryFn: () => api.get('/supplements') as any,
  });

  const items: any[] = Array.isArray(supplements) ? supplements : (supplements as any)?.data ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.header}>Supplement Store</Text>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 32 }} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No supplements available</Text>
      ) : (
        <View style={styles.grid}>
          {items.map((item: any) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.imgPlaceholder}>
                <Text style={{ fontSize: 32 }}>💊</Text>
              </View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.price}>
                {item.discountPrice ? (
                  <>₹{item.discountPrice}</>
                ) : (
                  <>₹{item.price}</>
                )}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { color: '#F9FAFB', fontSize: 22, fontWeight: '700', paddingHorizontal: 20, paddingTop: 56, marginBottom: 20 },
  empty: { color: '#4B5563', fontSize: 13, paddingHorizontal: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 },
  card: {
    width: '47%', backgroundColor: '#1A1A1A', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#2A2A2A',
  },
  imgPlaceholder: {
    backgroundColor: '#262626', borderRadius: 10, height: 80,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  name: { color: '#F9FAFB', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  category: { color: '#9CA3AF', fontSize: 11, marginBottom: 6 },
  price: { color: '#FF4D00', fontSize: 15, fontWeight: '700' },
});
