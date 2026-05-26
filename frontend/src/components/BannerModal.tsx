import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';

const BACKEND_URL = 'https://squash-coach-api-804061220370.us-central1.run.app';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Banner {
  banner_id: string;
  title?: string;
  body?: string;
  media_url?: string;
  media_type?: string; // "image" | "video" | "youtube" | "none"
  action_url?: string;
  action_label?: string;
}

function detectMediaType(url?: string, explicit?: string): 'image' | 'video' | 'youtube' | 'none' {
  if (explicit && explicit !== 'auto' && explicit !== 'none') {
    if (explicit === 'image' || explicit === 'video' || explicit === 'youtube') {
      return explicit;
    }
  }
  if (!url) return 'none';
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.match(/\.(mp4|mov|webm|m4v)(\?.*)?$/)) return 'video';
  if (u.match(/\.(png|jpg|jpeg|gif|webp|bmp)(\?.*)?$/)) return 'image';
  return 'image'; // fallback
}

function getYouTubeEmbedUrl(url: string): string {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/);
  const videoId = ytMatch ? ytMatch[1] : '';
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export const BannerModal: React.FC = () => {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/banners/active`);
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data && (data.title || data.body || data.media_url)) {
          setBanner(data);
          setVisible(true);
        }
      } catch (_e) {
        // silently ignore network errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAction = async () => {
    if (banner?.action_url) {
      try {
        await Linking.openURL(banner.action_url);
      } catch (_e) {
        // ignore
      }
    }
  };

  if (loading || !visible || !banner) return null;

  const mediaType = detectMediaType(banner.media_url, banner.media_type);
  const mediaUrl = banner.media_url || '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.card} data-testid="banner-modal">
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setVisible(false)}
            data-testid="banner-close-btn"
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {mediaType === 'image' && mediaUrl ? (
              <Image
                source={{ uri: mediaUrl }}
                style={styles.media}
                resizeMode="cover"
                data-testid="banner-image"
              />
            ) : null}

            {mediaType === 'video' && mediaUrl ? (
              <Video
                source={{ uri: mediaUrl }}
                style={styles.media}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
              />
            ) : null}

            {mediaType === 'youtube' && mediaUrl ? (
              <View style={styles.media}>
                <WebView
                  source={{ uri: getYouTubeEmbedUrl(mediaUrl) }}
                  style={{ flex: 1, backgroundColor: '#000' }}
                  allowsFullscreenVideo
                  javaScriptEnabled
                  domStorageEnabled
                />
              </View>
            ) : null}

            <View style={styles.textBlock}>
              {banner.title ? (
                <Text style={styles.title} data-testid="banner-title">
                  {banner.title}
                </Text>
              ) : null}
              {banner.body ? (
                <Text style={styles.body} data-testid="banner-body">
                  {banner.body}
                </Text>
              ) : null}
              {banner.action_url ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleAction}
                  data-testid="banner-action-btn"
                >
                  <Text style={styles.actionText}>
                    {banner.action_label || 'Ver más'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 480);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: CARD_WIDTH,
    maxHeight: '85%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
  },
  scrollContent: {
    flexGrow: 1,
  },
  media: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBlock: {
    padding: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E3A5F',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    color: '#444',
    lineHeight: 21,
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  actionText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default BannerModal;
