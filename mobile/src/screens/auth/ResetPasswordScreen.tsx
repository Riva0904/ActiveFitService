import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { api } from '../../lib/api';

export default function ResetPasswordScreen({ route, navigation }: any) {
  const { email } = route.params as { email: string };
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!otp || !newPassword) { Alert.alert('Error', 'Fill all fields'); return; }
    if (newPassword.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      Alert.alert('Success', 'Password reset. Please login.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>Enter the OTP sent to {email} and your new password</Text>

      <Text style={styles.label}>OTP Code</Text>
      <TextInput
        style={styles.input}
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        placeholder="123456"
        placeholderTextColor="#6B7280"
        maxLength={6}
      />

      <Text style={styles.label}>New Password</Text>
      <TextInput
        style={styles.input}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        placeholder="Min 8 characters"
        placeholderTextColor="#6B7280"
      />

      <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset Password</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F', padding: 24, paddingTop: 60 },
  back: { marginBottom: 32 },
  backText: { color: '#9CA3AF', fontSize: 15 },
  title: { fontSize: 28, fontWeight: '800', color: '#F9FAFB', marginBottom: 8 },
  subtitle: { color: '#9CA3AF', fontSize: 14, marginBottom: 32, lineHeight: 22 },
  label: { color: '#E5E7EB', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#374151',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#F9FAFB', fontSize: 15, marginBottom: 16,
  },
  btn: {
    backgroundColor: '#FF4D00', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
