import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/src/context/LanguageContext';

export default function Sombras() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="sombras-back-btn">
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('sombras.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.featureBtn, { backgroundColor: '#FF5722' }]}
          onPress={() => router.push('/shadow-training')}
          data-testid="new-shadow-btn"
        >
          <View style={styles.iconCircle}>
            <Ionicons name="footsteps-outline" size={36} color="#FFF" />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{t('sombras.newShadow')}</Text>
            <Text style={styles.featureSub}>{t('sombras.newShadowDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={26} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.featureBtn, { backgroundColor: '#1E3A5F' }]}
          onPress={() => router.push('/shadow-history')}
          data-testid="shadow-history-btn"
        >
          <View style={styles.iconCircle}>
            <Ionicons name="time-outline" size={36} color="#FFF" />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{t('sombras.history')}</Text>
            <Text style={styles.featureSub}>{t('sombras.historyDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={26} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    backgroundColor: '#1E3A5F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: { flex: 1, padding: 20, justifyContent: 'center', gap: 18 },
  featureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 22,
    borderRadius: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  featureSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
});
