import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function TrainerMembersScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['trainer-assigned-members'],
    queryFn: () => api.get('/pt-sessions/assigned-members') as any,
  });

  const members: any[] = Array.isArray(data) ? data : [];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Assigned Members</Text>
      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.user?.firstName?.[0]}{item.user?.lastName?.[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.user?.firstName} {item.user?.lastName}</Text>
                <Text style={styles.code}>{item.memberCode}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No members assigned</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { color: '#F9FAFB', fontSize: 22, fontWeight: '700', paddingHorizontal: 20, paddingTop: 56, marginBottom: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF4D00',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  name: { color: '#F9FAFB', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  code: { color: '#9CA3AF', fontSize: 12 },
  empty: { color: '#4B5563', fontSize: 14, textAlign: 'center', marginTop: 32 },
});
