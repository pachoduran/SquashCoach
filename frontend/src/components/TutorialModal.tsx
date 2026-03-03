import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/src/context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TutorialStep {
  icon: string;
  iconColor: string;
  bgColor: string;
  titleKey: string;
  descKey: string;
}

const STEPS: TutorialStep[] = [
  {
    icon: 'tennisball',
    iconColor: '#4CAF50',
    bgColor: '#E8F5E9',
    titleKey: 'tutorial.welcome_title',
    descKey: 'tutorial.welcome_desc',
  },
  {
    icon: 'add-circle',
    iconColor: '#2196F3',
    bgColor: '#E3F2FD',
    titleKey: 'tutorial.newMatch_title',
    descKey: 'tutorial.newMatch_desc',
  },
  {
    icon: 'flag',
    iconColor: '#FF9800',
    bgColor: '#FFF3E0',
    titleKey: 'tutorial.scoring_title',
    descKey: 'tutorial.scoring_desc',
  },
  {
    icon: 'time',
    iconColor: '#9C27B0',
    bgColor: '#F3E5F5',
    titleKey: 'tutorial.history_title',
    descKey: 'tutorial.history_desc',
  },
  {
    icon: 'analytics',
    iconColor: '#F44336',
    bgColor: '#FFEBEE',
    titleKey: 'tutorial.analysis_title',
    descKey: 'tutorial.analysis_desc',
  },
  {
    icon: 'cloud-upload',
    iconColor: '#00BCD4',
    bgColor: '#E0F7FA',
    titleKey: 'tutorial.cloud_title',
    descKey: 'tutorial.cloud_desc',
  },
  {
    icon: 'people',
    iconColor: '#FF5722',
    bgColor: '#FBE9E7',
    titleKey: 'tutorial.share_title',
    descKey: 'tutorial.share_desc',
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<Props> = ({ visible, onClose }) => {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const goToNext = () => {
    if (currentIndex < STEPS.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
      handleClose();
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      flatListRef.current?.scrollToIndex({ index: prev, animated: true });
      setCurrentIndex(prev);
    }
  };

  const handleClose = () => {
    setCurrentIndex(0);
    flatListRef.current?.scrollToIndex({ index: 0, animated: false });
    onClose();
  };

  const onMomentumScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const renderStep = ({ item, index }: { item: TutorialStep; index: number }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={[styles.iconContainer, { backgroundColor: item.bgColor }]}>
        <Ionicons name={item.icon as any} size={80} color={item.iconColor} />
      </View>
      <Text style={styles.stepCounter}>{index + 1} / {STEPS.length}</Text>
      <Text style={styles.title}>{t(item.titleKey)}</Text>
      <Text style={styles.description}>{t(item.descKey)}</Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>

          {/* Slides */}
          <FlatList
            ref={flatListRef}
            data={STEPS}
            renderItem={renderStep}
            keyExtractor={(_, i) => i.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />

          {/* Dots */}
          <View style={styles.dotsContainer}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {currentIndex > 0 ? (
              <TouchableOpacity style={styles.prevButton} onPress={goToPrev}>
                <Ionicons name="arrow-back" size={18} color="#1E3A5F" />
                <Text style={styles.prevText}>{t('tutorial.prev')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.placeholder} />
            )}

            <TouchableOpacity style={styles.nextButton} onPress={goToNext}>
              <Text style={styles.nextText}>
                {currentIndex === STEPS.length - 1 ? t('tutorial.start') : t('tutorial.next')}
              </Text>
              <Ionicons
                name={currentIndex === STEPS.length - 1 ? 'checkmark' : 'arrow-forward'}
                size={18}
                color="#FFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: SCREEN_WIDTH * 0.9,
    maxHeight: '80%',
    overflow: 'hidden',
    paddingBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 6,
  },
  slide: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 50,
    paddingBottom: 10,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepCounter: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A5F',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#1E3A5F',
    width: 24,
  },
  dotInactive: {
    backgroundColor: '#D0D0D0',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  prevText: {
    fontSize: 14,
    color: '#1E3A5F',
    fontWeight: '600',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 6,
  },
  nextText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: 'bold',
  },
  placeholder: {
    width: 80,
  },
});
