import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { api } from '../../lib/api';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!email) { Alert.alert('Error', 'Enter your email'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      navigation.navigate('ResetPassword', { email });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>Enter your email to receive a reset OTP</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="you@email.com"
        placeholderTextColor="#6B7280"
      />

      <TouchableOpacity style={styles.btn} onPress={handleSend} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F', padding: 24, paddingTop: 60 },
  back: { marginBottom: 32 },
  backText: { color: '#9CA3AF', fontSize: 15 },
  title: { fontSize: 28, fontWeight: '800', color: '#F9FAFB', marginBottom: 8 },
  subtitle: { color: '#9CA3AF', fontSize: 14, marginBottom: 32 },
  label: { color: '#E5E7EB', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#374151',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#F9FAFB', fontSize: 15, marginBottom: 24,
  },
  btn: {
    backgroundColor: '#FF4D00', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
