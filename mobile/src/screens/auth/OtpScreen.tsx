import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function OtpScreen({ route, navigation }: any) {
  const { email, purpose } = route.params as { email: string; purpose: string };
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const refs = useRef<(TextInput | null)[]>([]);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const id = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  function handleChange(value: string, index: number) {
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyPress(e: any, index: number) {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      Alert.alert('Error', 'Enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const res: any = await api.post('/auth/verify-email', { email, otp: code });
      if (res.user && res.accessToken) {
        await setAuth(res.user, res.accessToken, res.refreshToken);
      } else {
        navigation.navigate('Login');
      }
    } catch (err: any) {
      Alert.alert('Invalid Code', err?.message ?? 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await api.post('/auth/resend-otp', { email, purpose });
      setCountdown(RESEND_SECONDS);
      Alert.alert('Sent', 'A new OTP was sent to your email');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not resend OTP');
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Verify Email</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to{'\n'}{email}</Text>

      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
            value={digit}
            onChangeText={(v) => handleChange(v, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleVerify} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
      </TouchableOpacity>

      <View style={styles.resendRow}>
        {countdown > 0 ? (
          <Text style={styles.countdownText}>Resend in {countdown}s</Text>
        ) : (
          <TouchableOpacity onPress={handleResend}>
            <Text style={styles.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F', padding: 24, paddingTop: 60 },
  back: { marginBottom: 32 },
  backText: { color: '#9CA3AF', fontSize: 15 },
  title: { fontSize: 28, fontWeight: '800', color: '#F9FAFB', marginBottom: 8 },
  subtitle: { color: '#9CA3AF', fontSize: 14, marginBottom: 32, lineHeight: 22 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  otpBox: {
    width: 48, height: 56, borderRadius: 12,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#374151',
    textAlign: 'center', color: '#F9FAFB', fontSize: 22, fontWeight: '700',
  },
  otpBoxFilled: { borderColor: '#FF4D00' },
  btn: {
    backgroundColor: '#FF4D00', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 16,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  resendRow: { alignItems: 'center' },
  countdownText: { color: '#6B7280', fontSize: 14 },
  resendText: { color: '#FF4D00', fontSize: 14, fontWeight: '600' },
});
