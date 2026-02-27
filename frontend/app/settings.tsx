import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase } from '@/src/store/database';
import { useAuth } from '@/src/context/AuthContext';

interface CustomReason {
  id: number;
  name: string;
  is_active: number;
}

export default function Settings() {
  const router = useRouter();
  const [reasons, setReasons] = useState<CustomReason[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReasonName, setNewReasonName] = useState('');

  useEffect(() => {
    loadReasons();
  }, []);

  const loadReasons = async () => {
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync(
        'SELECT * FROM custom_reasons ORDER BY name ASC'
      );
      setReasons(result as CustomReason[]);
    } catch (error) {
      console.error('Error cargando motivos:', error);
    }
  };

  const addReason = async () => {
    if (!newReasonName.trim()) {
      Alert.alert('Error', 'Por favor ingresa un nombre para el motivo');
      return;
    }

    try {
      const db = await getDatabase();
      await db.runAsync(
        'INSERT INTO custom_reasons (name, is_active) VALUES (?, 1)',
        [newReasonName.trim()]
      );
      setNewReasonName('');
      setShowAddModal(false);
      loadReasons();
      Alert.alert('Éxito', 'Motivo agregado correctamente');
    } catch (error: any) {
      if (error.message?.includes('UNIQUE')) {
        Alert.alert('Error', 'Este motivo ya existe');
      } else {
        console.error('Error agregando motivo:', error);
        Alert.alert('Error', 'No se pudo agregar el motivo');
      }
    }
  };

  const toggleReason = async (reason: CustomReason) => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        'UPDATE custom_reasons SET is_active = ? WHERE id = ?',
        [reason.is_active ? 0 : 1, reason.id]
      );
      loadReasons();
    } catch (error) {
      console.error('Error actualizando motivo:', error);
      Alert.alert('Error', 'No se pudo actualizar el motivo');
    }
  };

  const deleteReason = async (reason: CustomReason) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de eliminar "${reason.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.runAsync('DELETE FROM custom_reasons WHERE id = ?', [reason.id]);
              loadReasons();
              Alert.alert('Éxito', 'Motivo eliminado');
            } catch (error) {
              console.error('Error eliminando motivo:', error);
              Alert.alert('Error', 'No se pudo eliminar el motivo');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Motivos de Puntos</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add-circle" size={28} color="#2196F3" />
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionDescription}>
            Personaliza los motivos que puedes usar para registrar puntos
          </Text>

          {reasons.map((reason) => (
            <View key={reason.id} style={styles.reasonItem}>
              <TouchableOpacity
                style={styles.reasonInfo}
                onPress={() => toggleReason(reason)}
              >
                <Ionicons
                  name={reason.is_active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={reason.is_active ? '#4CAF50' : '#CCC'}
                />
                <Text
                  style={[
                    styles.reasonName,
                    !reason.is_active && styles.reasonNameInactive,
                  ]}
                >
                  {reason.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteReason(reason)}
              >
                <Ionicons name="trash-outline" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acerca de</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Squash Analyzer</Text>
            <Text style={styles.infoText}>Versión 1.0.0</Text>
            <Text style={styles.infoDescription}>
              Aplicación para análisis detallado de partidos de squash. Registra puntos, posiciones y motivos para mejorar tu juego.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Modal para agregar motivo */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Motivo</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Nombre del motivo"
              value={newReasonName}
              onChangeText={setNewReasonName}
              placeholderTextColor="#999"
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowAddModal(false);
                  setNewReasonName('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={addReason}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Agregar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#1E3A5F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  section: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  addButton: {
    padding: 4,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reasonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reasonName: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  reasonNameInactive: {
    color: '#999',
    textDecorationLine: 'line-through',
  },
  deleteButton: {
    padding: 8,
  },
  infoCard: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  infoDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  modalButtonPrimary: {
    backgroundColor: '#2196F3',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonTextPrimary: {
    color: '#FFF',
  },
});