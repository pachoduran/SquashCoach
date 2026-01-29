import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Image, Animated } from 'react-native';
import { AuthProvider } from '@/src/context/AuthContext';
import { LanguageProvider } from '@/src/context/LanguageContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

// Prevent auto-hide of splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const fadeAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    async function prepare() {
      // Wait 2 seconds to show splash
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setIsReady(true);
      });
      
      // Hide native splash
      await SplashScreen.hideAsync();
    }
    
    prepare();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.splashContainer}>
        <Animated.Image
          source={require('../assets/images/splash-icon.png')}
          style={[styles.splashImage, { opacity: fadeAnim }]}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <GestureHandlerRootView style={styles.container}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="new-match" />
              <Stack.Screen name="match-play" />
              <Stack.Screen name="match-summary" />
              <Stack.Screen name="history" />
              <Stack.Screen name="player-analysis" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="analysis" />
              <Stack.Screen name="cloud-matches" />
            </Stack>
          </GestureHandlerRootView>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#4848A0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashImage: {
    width: 300,
    height: 300,
  },
});
