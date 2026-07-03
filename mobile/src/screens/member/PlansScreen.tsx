import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function PlansScreen() {
  const user = useAuthStore((s) => s.user);

  const { data: workouts, isLoading: wLoading } = useQuery({
    queryKey: ['my-workouts'],
    queryFn: () => api.get('/workout-plans/my') as any,
    enabled: !!user,
  });

  const { data: diets, isLoading: dLoading } = useQuery({
    queryKey: ['my-diets'],
    queryFn: () => api.get('/diet-plans/my') as any,
    enabled: !!user,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.header}>My Plans</Text>

      <Text style={styles.section}>💪 Workout Plans</Text>
      {wLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginVertical: 16 }} />
      ) : Array.isArray(workouts) && workouts.length > 0 ? (
        workouts.map((w: any) => (
          <View key={w.id} style={styles.card}>
            <Text style={styles.cardTitle}>{w.workoutPlan?.name ?? 'Plan'}</Text>
            <Text style={styles.cardSub}>{w.workoutPlan?.goal} · {w.workoutPlan?.difficulty}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No workout plans assigned yet</Text>
      )}

      <Text style={styles.section}>🥗 Diet Plans</Text>
      {dLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginVertical: 16 }} />
      ) : Array.isArray(diets) && diets.length > 0 ? (
        diets.map((d: any) => (
          <View key={d.id} style={styles.card}>
            <Text style={styles.cardTitle}>{d.dietPlan?.name ?? 'Diet'}</Text>
            <Text style={styles.cardSub}>{d.dietPlan?.totalCalories ? `${d.dietPlan.totalCalories} kcal/day` : ''}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No diet plans assigned yet</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { color: '#F9FAFB', fontSize: 22, fontWeight: '700', paddingHorizontal: 20, paddingTop: 56, marginBottom: 8 },
  section: { color: '#E5E7EB', fontSize: 16, fontWeight: '700', paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },
  card: {
    marginHorizontal: 20, marginBottom: 10, backgroundColor: '#1A1A1A',
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardTitle: { color: '#F9FAFB', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cardSub: { color: '#9CA3AF', fontSize: 13 },
  empty: { color: '#4B5563', fontSize: 13, paddingHorizontal: 20, marginBottom: 8 },
});
