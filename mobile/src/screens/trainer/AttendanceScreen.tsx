import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function TrainerAttendanceScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: homeData, isLoading } = useQuery({
    queryKey: ['trainer-home'],
    queryFn: () => api.get('/mobile/trainer-home') as any,
    enabled: !!user,
  });

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/mobile/checkin', {}) as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainer-home'] }),
    onError: (e: any) => Alert.alert('Error', e?.message),
  });

  const isCheckedIn = (homeData as any)?.isCheckedInToday ?? false;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Attendance</Text>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 32 }} />
      ) : (
        <>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Today's Status</Text>
            <Text style={[styles.statusValue, { color: isCheckedIn ? '#22C55E' : '#EF4444' }]}>
              {isCheckedIn ? '✅ Checked In' : '❌ Not Checked In'}
            </Text>
            {isCheckedIn && (homeData as any)?.checkedInAt && (
              <Text style={styles.checkTime}>
                Since {new Date((homeData as any).checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>

          {!isCheckedIn && (
            <TouchableOpacity
              style={styles.btn}
              onPress={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
            >
              {checkInMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>✅ Check In Now</Text>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F', padding: 20, paddingTop: 56 },
  header: { color: '#F9FAFB', fontSize: 22, fontWeight: '700', marginBottom: 24 },
  statusCard: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center', marginBottom: 24,
  },
  statusLabel: { color: '#9CA3AF', fontSize: 13, marginBottom: 8 },
  statusValue: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  checkTime: { color: '#6B7280', fontSize: 12 },
  btn: {
    backgroundColor: '#FF4D00', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
