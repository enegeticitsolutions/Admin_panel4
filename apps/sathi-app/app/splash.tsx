import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Image,
  Dimensions,
  StyleSheet,
  FlatList,
  ViewToken,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SLIDES = [
  { key: '1', image: require('@/assets/images/Flash_1.jpg') },
  { key: '2', image: require('@/assets/images/Flash_2.jpg') },
  { key: '3', image: require('@/assets/images/Flash_3.jpg') },
];

/** Duration each slide stays visible (ms) */
const SLIDE_DURATION = 1000;

// ── Animated Dot ────────────────────────────────────────────────────────────────
function Dot({ index, activeIndex }: { index: number; activeIndex: number }) {
  const isActive = index === activeIndex;

  const scale = useSharedValue(isActive ? 1 : 0.8);
  const opacity = useSharedValue(isActive ? 1 : 0.35);
  const dotWidth = useSharedValue(isActive ? 24 : 8);

  useEffect(() => {
    scale.value = withTiming(isActive ? 1 : 0.8, { duration: 300 });
    opacity.value = withTiming(isActive ? 1 : 0.35, { duration: 300 });
    dotWidth.value = withTiming(isActive ? 24 : 8, { duration: 300 });
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: dotWidth.value,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

// ── Main Splash Screen ──────────────────────────────────────────────────────────
export default function SplashScreen() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track visible item
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const navigateAway = useCallback(() => {
    if (isLoggedIn) {
      router.replace('/(sathi)');
    } else {
      router.replace('/(auth)');
    }
  }, [isLoggedIn, router]);

  // Auto-advance timer
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (activeIndex < SLIDES.length - 1) {
        flatListRef.current?.scrollToIndex({
          index: activeIndex + 1,
          animated: true,
        });
      } else {
        // Last slide finished → navigate away
        navigateAway();
      }
    }, SLIDE_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIndex, navigateAway]);

  const renderItem = useCallback(
    ({ item }: { item: (typeof SLIDES)[number] }) => (
      <View style={styles.slide}>
        <Image source={item.image} style={styles.image} resizeMode="cover" />
      </View>
    ),
    []
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Dot indicators */}
      <View style={styles.pagination}>
        {SLIDES.map((_, i) => (
          <Dot key={i} index={i} activeIndex={activeIndex} />
        ))}
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  pagination: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FE6700',
  },
});
