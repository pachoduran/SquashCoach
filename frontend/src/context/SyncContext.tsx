import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { syncService } from '@/src/store/syncService';
import { useAuth } from './AuthContext';

interface SyncStats {
  uploaded: number;
  downloaded: number;
}

interface SyncContextValue {
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncAt: Date | null;
  lastSyncStats: SyncStats | null;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue>({
  isSyncing: false,
  isOnline: true,
  lastSyncAt: null,
  lastSyncStats: null,
  syncNow: async () => {},
});

export const useSync = () => useContext(SyncContext);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastSyncStats, setLastSyncStats] = useState<SyncStats | null>(null);
  const wasOnlineRef = useRef(true);
  const appStateRef = useRef(AppState.currentState);

  const syncNow = useCallback(async () => {
    if (!isAuthenticated || !user?.user_id) return;
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncService.syncAll(user.user_id);
      if (res.success) {
        const up = res.uploaded.players + res.uploaded.tournaments + res.uploaded.matches + res.uploaded.shadows;
        const down = res.downloaded.players + res.downloaded.tournaments + res.downloaded.matches + res.downloaded.shadows;
        setLastSyncStats({ uploaded: up, downloaded: down });
        setLastSyncAt(new Date());
      }
    } catch (e) {
      console.error('[SyncContext] Error en syncNow:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, user, isSyncing]);

  // NetInfo listener: auto-sync cuando vuelva la conexión
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true;
      setIsOnline(online);
      // Cuando pase de offline → online, lanzar sync
      if (online && !wasOnlineRef.current && isAuthenticated) {
        console.log('[SyncContext] Conexión restaurada, sincronizando...');
        syncNow();
      }
      wasOnlineRef.current = online;
    });
    return () => unsub();
  }, [isAuthenticated, syncNow]);

  // AppState listener: sync al volver del background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active' &&
        isAuthenticated
      ) {
        console.log('[SyncContext] App vuelve al foreground, sincronizando...');
        syncNow();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [isAuthenticated, syncNow]);

  // Sync inicial al autenticarse
  useEffect(() => {
    if (isAuthenticated && user?.user_id) {
      syncNow();
    }
  }, [isAuthenticated, user?.user_id]);

  return (
    <SyncContext.Provider
      value={{ isSyncing, isOnline, lastSyncAt, lastSyncStats, syncNow }}
    >
      {children}
    </SyncContext.Provider>
  );
};
