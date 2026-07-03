import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function AttendanceScreen() {
  const user = useAuthStore((s) => s.user);

  const { data: homeData, isLoading } = useQuery({
    queryKey: ['mobile-home'],
    queryFn: () => api.get('/mobile/home') as any,
    enabled: !!user,
  });

  const { data: streak } = useQuery({
    queryKey: ['attendance-streak'],
    queryFn: () => api.get('/attendance/streak') as any,
    enabled: !!user,
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color="#FF4D00" size="large" /></View>;
  }

  const qrToken: string = homeData?.qrToken ?? '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.header}>My QR Code</Text>
      <Text style={styles.sub}>Show this to the gym scanner or staff</Text>

      <View style={styles.qrCard}>
        {qrToken ? (
          <QRCode value={qrToken} size={200} backgroundColor="#1A1A1A" color="#F9FAFB" />
        ) : (
          <Text style={styles.noQr}>No QR token available</Text>
        )}
        {homeData?.memberCode && (
          <Text style={styles.memberCode}>{homeData.memberCode}</Text>
        )}
      </View>

      {/* Streak */}
      <View style={styles.streakRow}>
        <View style={styles.streakCard}>
          <Text style={styles.streakNum}>{(streak as any)?.currentStreak ?? 0}</Text>
          <Text style={styles.streakLabel}>Current Streak 🔥</Text>
        </View>
        <View style={styles.streakCard}>
          <Text style={styles.streakNum}>{(streak as any)?.bestStreak ?? 0}</Text>
          <Text style={styles.streakLabel}>Best Streak 🏆</Text>
        </View>
      </View>

      <Text style={styles.comingSoon}>Full calendar & leaderboard coming soon</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F0F0F' },
  header: { color: '#F9FAFB', fontSize: 22, fontWeight: '700', paddingHorizontal: 20, paddingTop: 56, marginBottom: 4 },
  sub: { color: '#9CA3AF', fontSize: 13, paddingHorizontal: 20, marginBottom: 24 },
  qrCard: {
    marginHorizontal: 20, backgroundColor: '#1A1A1A', borderRadius: 20,
    padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
    marginBottom: 24,
  },
  noQr: { color: '#6B7280', fontSize: 14 },
  memberCode: { color: '#FF4D00', fontWeight: '700', fontSize: 18, marginTop: 16, letterSpacing: 4 },
  streakRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 24 },
  streakCard: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  streakNum: { color: '#FF4D00', fontSize: 36, fontWeight: '800', marginBottom: 4 },
  streakLabel: { color: '#9CA3AF', fontSize: 13, textAlign: 'center' },
  comingSoon: { color: '#4B5563', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
});
