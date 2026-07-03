import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { MobileHomeData } from '../../types';

function StatCard({ label, value, color = '#FF4D00' }: { label: string; value: string; color?: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MembershipCard({ data }: { data: MobileHomeData }) {
  if (!data.membership) {
    return (
      <View style={[styles.memberCard, { borderColor: '#EF4444' }]}>
        <Text style={styles.memberCardTitle}>No Active Membership</Text>
        <Text style={styles.memberCardSub}>Renew to access the gym</Text>
      </View>
    );
  }
  const end = new Date(data.membership.endDate);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  return (
    <View style={styles.memberCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={styles.memberCardTitle}>{data.membership.plan.name}</Text>
          <Text style={styles.memberCardSub}>{data.membership.plan.type}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: daysLeft < 7 ? '#EF4444' : '#22C55E' }]}>
          <Text style={styles.badgeText}>{daysLeft}d left</Text>
        </View>
      </View>
      <Text style={styles.expiry}>Expires {end.toLocaleDateString('en-IN')}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, refetch, isRefetching } = useQuery<MobileHomeData>({
    queryKey: ['mobile-home'],
    queryFn: () => api.get('/mobile/home') as any,
    enabled: !!user,
  });

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/mobile/checkin', {}) as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
    onError: (err: any) => Alert.alert('Check-in failed', err?.message ?? 'Try again'),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-out') as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
    onError: (err: any) => Alert.alert('Check-out failed', err?.message ?? 'Try again'),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FF4D00" size="large" />
      </View>
    );
  }

  const isCheckedIn = data?.isCheckedInToday ?? false;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF4D00" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getGreeting()} 👋</Text>
          <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        </View>
        {data?.membership && (
          <View style={styles.memberCodeBadge}>
            <Text style={styles.memberCodeText}>{data.memberCode}</Text>
          </View>
        )}
      </View>

      {/* Check-in button */}
      <TouchableOpacity
        style={[styles.checkInBtn, isCheckedIn && styles.checkOutBtn]}
        onPress={() => isCheckedIn ? checkOutMutation.mutate() : checkInMutation.mutate()}
        disabled={checkInMutation.isPending || checkOutMutation.isPending}
      >
        {(checkInMutation.isPending || checkOutMutation.isPending) ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.checkInIcon}>{isCheckedIn ? '🚪' : '✅'}</Text>
            <Text style={styles.checkInText}>{isCheckedIn ? 'Check Out' : 'Check In'}</Text>
            {data?.checkedInAt && isCheckedIn && (
              <Text style={styles.checkInSub}>
                Since {new Date(data.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </>
        )}
      </TouchableOpacity>

      {/* Membership card */}
      {data && <MembershipCard data={data} />}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard label="Today" value={isCheckedIn ? 'Active' : 'Not checked in'} />
        {data?.activeWorkout && <StatCard label="Workout" value={data.activeWorkout.name} color="#7C3AED" />}
        {data?.activeDiet && <StatCard label="Diet Plan" value={data.activeDiet.name} color="#059669" />}
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        {[
          { label: 'QR Code', icon: '📱', tab: 'Attendance' },
          { label: 'Workout', icon: '🏋️', tab: 'Plans' },
          { label: 'Diet', icon: '🥗', tab: 'Plans' },
          { label: 'Progress', icon: '📊', tab: 'Plans' },
          { label: 'Store', icon: '🛒', tab: 'Store' },
          { label: 'Profile', icon: '👤', tab: 'Profile' },
        ].map((action) => (
          <View key={action.label} style={styles.quickCard}>
            <Text style={styles.quickIcon}>{action.icon}</Text>
            <Text style={styles.quickLabel}>{action.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  greeting: { color: '#9CA3AF', fontSize: 14 },
  name: { color: '#F9FAFB', fontSize: 22, fontWeight: '700', marginTop: 2 },
  memberCodeBadge: {
    backgroundColor: '#1A1A1A', borderRadius: 8, borderWidth: 1,
    borderColor: '#FF4D00', paddingHorizontal: 10, paddingVertical: 4,
  },
  memberCodeText: { color: '#FF4D00', fontWeight: '700', fontSize: 13 },
  checkInBtn: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FF4D00',
    borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    shadowColor: '#FF4D00', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  checkOutBtn: { backgroundColor: '#374151' },
  checkInIcon: { fontSize: 28, marginBottom: 4 },
  checkInText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  checkInSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  memberCard: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#1A1A1A',
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#FF4D00',
  },
  memberCardTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
  memberCardSub: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  expiry: { color: '#6B7280', fontSize: 12, marginTop: 10 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    borderLeftWidth: 3,
  },
  statValue: { color: '#F9FAFB', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  statLabel: { color: '#6B7280', fontSize: 11 },
  sectionTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10,
  },
  quickCard: {
    width: '30%', backgroundColor: '#1A1A1A', borderRadius: 12,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  quickIcon: { fontSize: 24, marginBottom: 6 },
  quickLabel: { color: '#9CA3AF', fontSize: 12, textAlign: 'center' },
});
