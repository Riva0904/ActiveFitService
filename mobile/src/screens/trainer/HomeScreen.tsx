import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { TrainerHomeData } from '../../types';

export default function TrainerHomeScreen() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, refetch, isRefetching } = useQuery<TrainerHomeData>({
    queryKey: ['trainer-home'],
    queryFn: () => api.get('/mobile/trainer-home') as any,
    enabled: !!user,
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color="#FF4D00" size="large" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF4D00" />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back 👋</Text>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{data?.assignedMembersCount ?? 0}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{data?.sessionsToday ?? 0}</Text>
          <Text style={styles.statLabel}>Sessions Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{data?.unreadNotifications ?? 0}</Text>
          <Text style={styles.statLabel}>Notifications</Text>
        </View>
      </View>

      {/* Check-in status */}
      <View style={[styles.card, { borderLeftColor: data?.isCheckedInToday ? '#22C55E' : '#EF4444' }]}>
        <Text style={styles.cardTitle}>Today's Attendance</Text>
        <Text style={[styles.cardSub, { color: data?.isCheckedInToday ? '#22C55E' : '#EF4444' }]}>
          {data?.isCheckedInToday
            ? `Checked in at ${new Date(data.checkedInAt!).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
            : 'Not checked in yet'}
        </Text>
      </View>

      {/* Next session */}
      {data?.nextSession && (
        <View style={[styles.card, { borderLeftColor: '#7C3AED' }]}>
          <Text style={styles.cardTitle}>Next Session</Text>
          <Text style={styles.sessionMember}>{data.nextSession.memberName}</Text>
          <Text style={styles.cardSub}>
            {new Date(data.nextSession.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{data.nextSession.durationMinutes} min
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 },
  greeting: { color: '#9CA3AF', fontSize: 14 },
  name: { color: '#F9FAFB', fontSize: 22, fontWeight: '700', marginTop: 2 },
  statsGrid: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  statNum: { color: '#FF4D00', fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: '#9CA3AF', fontSize: 11, textAlign: 'center' },
  card: {
    marginHorizontal: 20, marginBottom: 12, backgroundColor: '#1A1A1A',
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2A2A2A',
    borderLeftWidth: 3,
  },
  cardTitle: { color: '#E5E7EB', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  cardSub: { color: '#9CA3AF', fontSize: 13 },
  sessionMember: { color: '#F9FAFB', fontSize: 16, fontWeight: '700', marginBottom: 4 },
});
