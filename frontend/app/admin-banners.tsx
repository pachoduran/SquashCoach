import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';

const BACKEND_URL = 'https://squash-coach-api-804061220370.us-central1.run.app';
const ADMIN_EMAILS = ['franciscoduransaa@gmail.com'];

type MediaType = 'auto' | 'image' | 'video' | 'youtube' | 'none';

interface Banner {
  banner_id: string;
  title?: string;
  body?: string;
  media_url?: string;
  media_type?: string;
  action_url?: string;
  action_label?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

const emptyForm = {
  title: '',
  body: '',
  media_url: '',
  media_type: 'auto' as MediaType,
  action_url: '',
  action_label: 'Ver más',
  is_active: true,
};

export default function AdminBannersScreen() {
  const router = useRouter();
  const { user, sessionToken } = useAuth();

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const isAdmin = user && ADMIN_EMAILS.includes((user.email || '').toLowerCase().trim());

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Acceso denegado', 'Esta sección es solo para administradores.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }
    loadBanners();
  }, [isAdmin]);

  const loadBanners = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/banners`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) {
        Alert.alert('Error', `No se pudo cargar (${res.status})`);
        return;
      }
      const data = await res.json();
      setBanners(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Error de red');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBanners();
  };

  const startEdit = (b: Banner) => {
    setEditingId(b.banner_id);
    setForm({
      title: b.title || '',
      body: b.body || '',
      media_url: b.media_url || '',
      media_type: (b.media_type as MediaType) || 'auto',
      action_url: b.action_url || '',
      action_label: b.action_label || 'Ver más',
      is_active: b.is_active !== false,
    });
  };

  const startNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const save = async () => {
    if (!sessionToken) return;
    if (!form.title && !form.body && !form.media_url) {
      Alert.alert('Falta contenido', 'Agrega al menos un título, texto o URL de imagen/video.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, media_type: form.media_type === 'auto' ? 'none' : form.media_type };
      const url = editingId
        ? `${BACKEND_URL}/api/banners/${editingId}`
        : `${BACKEND_URL}/api/banners`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        Alert.alert('Error', `No se pudo guardar: ${txt}`);
        return;
      }
      Alert.alert('Listo', editingId ? 'Banner actualizado' : 'Banner creado');
      setEditingId(null);
      setForm({ ...emptyForm });
      loadBanners();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Error de red');
    } finally {
      setSaving(false);
    }
  };

  const remove = (b: Banner) => {
    Alert.alert('Borrar banner', `¿Borrar "${b.title || b.banner_id}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${BACKEND_URL}/api/banners/${b.banner_id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${sessionToken}` },
            });
            if (!res.ok) {
              Alert.alert('Error', 'No se pudo borrar');
              return;
            }
            loadBanners();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Error de red');
          }
        },
      },
    ]);
  };

  const toggleActive = async (b: Banner) => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/banners/${b.banner_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: b.title || '',
          body: b.body || '',
          media_url: b.media_url || '',
          media_type: b.media_type || 'none',
          action_url: b.action_url || '',
          action_label: b.action_label || '',
          is_active: !b.is_active,
        }),
      });
      if (!res.ok) {
        Alert.alert('Error', 'No se pudo cambiar el estado');
        return;
      }
      loadBanners();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Error de red');
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text>Acceso restringido</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={28} color="#1E3A5F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Banners (Admin)</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* FORMULARIO */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{editingId ? 'Editar banner' : 'Nuevo banner'}</Text>

          <Text style={styles.label}>Título</Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={(v) => setForm({ ...form, title: v })}
            placeholder="Ej: ¡Nueva versión disponible!"
            data-testid="banner-form-title"
          />

          <Text style={styles.label}>Texto / Descripción</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={form.body}
            onChangeText={(v) => setForm({ ...form, body: v })}
            placeholder="Mensaje que verán los usuarios"
            multiline
            numberOfLines={4}
            data-testid="banner-form-body"
          />

          <Text style={styles.label}>URL de imagen o video (opcional)</Text>
          <TextInput
            style={styles.input}
            value={form.media_url}
            onChangeText={(v) => setForm({ ...form, media_url: v })}
            placeholder="https://... (.jpg, .png, .mp4 o YouTube)"
            autoCapitalize="none"
            keyboardType="url"
            data-testid="banner-form-media-url"
          />
          <Text style={styles.helper}>
            Soporta: imágenes (jpg/png/gif/webp), videos (mp4/mov) y enlaces de YouTube.
          </Text>

          <Text style={styles.label}>Tipo de medio</Text>
          <View style={styles.chipsRow}>
            {(['auto', 'image', 'video', 'youtube', 'none'] as MediaType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, form.media_type === t && styles.chipActive]}
                onPress={() => setForm({ ...form, media_type: t })}
              >
                <Text style={[styles.chipText, form.media_type === t && styles.chipTextActive]}>
                  {t === 'auto' ? 'Auto' : t === 'youtube' ? 'YouTube' : t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Link del botón (opcional)</Text>
          <TextInput
            style={styles.input}
            value={form.action_url}
            onChangeText={(v) => setForm({ ...form, action_url: v })}
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
            data-testid="banner-form-action-url"
          />

          <Text style={styles.label}>Texto del botón</Text>
          <TextInput
            style={styles.input}
            value={form.action_label}
            onChangeText={(v) => setForm({ ...form, action_label: v })}
            placeholder="Ver más"
          />

          <View style={styles.switchRow}>
            <Text style={styles.label}>Activo (visible para usuarios)</Text>
            <Switch
              value={form.is_active}
              onValueChange={(v) => setForm({ ...form, is_active: v })}
            />
          </View>

          <View style={styles.formButtons}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={save}
              disabled={saving}
              data-testid="banner-form-save"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnTextPrimary}>
                  {editingId ? 'Actualizar' : 'Crear banner'}
                </Text>
              )}
            </TouchableOpacity>
            {editingId ? (
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={startNew}>
                <Text style={styles.btnTextGhost}>Cancelar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* LISTADO */}
        <Text style={styles.sectionTitle}>Banners existentes</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : banners.length === 0 ? (
          <Text style={styles.empty}>No hay banners todavía.</Text>
        ) : (
          banners.map((b) => (
            <View key={b.banner_id} style={styles.bannerItem}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {b.media_url && (b.media_type === 'image' || !b.media_type || b.media_type === 'none') ? (
                  <Image source={{ uri: b.media_url }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons
                      name={
                        b.media_type === 'video'
                          ? 'videocam'
                          : b.media_type === 'youtube'
                          ? 'logo-youtube'
                          : 'document-text'
                      }
                      size={24}
                      color="#999"
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle} numberOfLines={1}>
                    {b.title || '(sin título)'}
                  </Text>
                  <Text style={styles.bannerBody} numberOfLines={2}>
                    {b.body || '—'}
                  </Text>
                  <View style={styles.bannerMeta}>
                    <View style={[styles.dot, { backgroundColor: b.is_active ? '#4CAF50' : '#999' }]} />
                    <Text style={styles.bannerMetaText}>
                      {b.is_active ? 'Activo' : 'Inactivo'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.bannerActions}>
                <TouchableOpacity style={styles.actionPill} onPress={() => toggleActive(b)}>
                  <Ionicons name={b.is_active ? 'eye-off' : 'eye'} size={16} color="#1E3A5F" />
                  <Text style={styles.actionPillText}>
                    {b.is_active ? 'Desactivar' : 'Activar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionPill} onPress={() => startEdit(b)}>
                  <Ionicons name="pencil" size={16} color="#1E3A5F" />
                  <Text style={styles.actionPillText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionPill, { backgroundColor: '#FFEBEE' }]}
                  onPress={() => remove(b)}
                >
                  <Ionicons name="trash" size={16} color="#C62828" />
                  <Text style={[styles.actionPillText, { color: '#C62828' }]}>Borrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1E3A5F' },
  scroll: { flex: 1, padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E3A5F', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginTop: 10, marginBottom: 6 },
  helper: { fontSize: 11, color: '#888', marginTop: 4, fontStyle: 'italic' },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  chipText: { fontSize: 12, color: '#666', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  formButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2196F3' },
  btnTextPrimary: { color: '#fff', fontWeight: '700' },
  btnGhost: { backgroundColor: '#F0F0F0' },
  btnTextGhost: { color: '#1E3A5F', fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E3A5F', marginBottom: 10, marginTop: 4 },
  empty: { color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 12 },
  bannerItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  thumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#EEE' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A5F' },
  bannerBody: { fontSize: 12, color: '#666', marginTop: 2 },
  bannerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bannerMetaText: { fontSize: 11, color: '#888' },
  bannerActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
  },
  actionPillText: { fontSize: 12, color: '#1E3A5F', fontWeight: '600' },
});
