import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res: any = await api.post('/auth/mobile-login', { email, password });
      await setAuth(res.user, res.accessToken, res.refreshToken);
    } catch (err: any) {
      const msg = err?.message ?? 'Login failed';
      if (err?.code === 'EMAIL_NOT_VERIFIED') {
        navigation.navigate('Otp', { email, purpose: 'EMAIL_VERIFICATION' });
      } else {
        Alert.alert('Login Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>ActiveBoost</Text>
        <Text style={styles.tagline}>Your fitness journey starts here</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@email.com"
            placeholderTextColor="#6B7280"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor="#6B7280"
          />

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotRow}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: '800', color: '#FF4D00', textAlign: 'center', marginBottom: 4 },
  tagline: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 32 },
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  label: { color: '#E5E7EB', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#262626', borderWidth: 1, borderColor: '#374151',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#F9FAFB', fontSize: 15, marginBottom: 16,
  },
  forgotRow: { alignItems: 'flex-end', marginTop: -8, marginBottom: 20 },
  forgotText: { color: '#FF4D00', fontSize: 13 },
  btn: {
    backgroundColor: '#FF4D00', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
