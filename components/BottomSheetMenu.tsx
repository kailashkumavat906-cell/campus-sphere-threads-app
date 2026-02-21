import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useThemeContext } from '@/hooks/ThemeContext';

type MenuItem = {
  icon: string;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  subtitle?: string;
  isActive?: boolean;
};

type BottomSheetMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
  title?: string;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function BottomSheetMenu({ visible, onClose, items, title }: BottomSheetMenuProps) {
  const { colors } = useThemeContext();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const [isAnimating, setIsAnimating] = useState(false);

  const isDark = colors.background === '#000000';

  const animate = useCallback((toValue: number, callback?: () => void) => {
    setIsAnimating(true);
    Animated.timing(animatedValue, {
      toValue,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsAnimating(false);
      callback?.();
    });
  }, [animatedValue]);

  useEffect(() => {
    if (visible) {
      animate(1);
    } else {
      animate(0);
    }
  }, [visible, animate]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  const backdropOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        animatedValue.setValue(1 - event.translationY / 300);
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 500) {
        animate(0, onClose);
      } else {
        animate(1);
      }
    });

  const handleItemPress = (item: MenuItem) => {
    animate(0, () => {
      onClose();
      item.onPress?.();
    });
  };

  if (!visible && !isAnimating) return null;

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: {
      backgroundColor: colors.background,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    handleBar: {
      backgroundColor: isDark ? '#333333' : '#CCCCCC',
    },
    title: {
      color: isDark ? '#888888' : '#666666',
    },
    menuItem: {
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    menuLabel: {
      color: colors.text,
    },
    menuSubtitle: {
      color: isDark ? '#888888' : '#666666',
    },
    chevron: {
      color: isDark ? '#666666' : '#999999',
    },
  };

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
      </Animated.View>
      
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.container,
            dynamicStyles.container,
            {
              transform: [{ translateY }],
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          {/* Handle Bar */}
          <View style={[styles.handleBar, dynamicStyles.handleBar]} />
          
          {/* Title */}
          {title && (
            <Text style={[styles.title, dynamicStyles.title]}>{title}</Text>
          )}
          
          {/* Menu Items */}
          <View style={styles.itemsContainer}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  dynamicStyles.menuItem,
                  index === items.length - 1 && styles.lastItem,
                ]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <Ionicons
                    name={item.icon as any}
                    size={22}
                    color={item.danger ? '#FF4444' : item.isActive ? '#007AFF' : colors.text}
                  />
                  <View style={styles.menuItemText}>
                    <Text style={[
                      styles.menuLabel, 
                      dynamicStyles.menuLabel,
                      item.danger && styles.dangerText,
                      item.isActive && styles.activeText,
                    ]}>
                      {item.label}
                    </Text>
                    {item.subtitle && (
                      <Text style={[styles.menuSubtitle, dynamicStyles.menuSubtitle]}>
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                </View>
                
                {/* Show checkmark for active item */}
                {item.isActive ? (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                ) : item.onPress ? (
                  <Ionicons name="chevron-forward" size={18} color={isDark ? '#666666' : '#999999'} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  backdropPressable: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    maxHeight: '80%',
    borderWidth: 1,
    borderTopWidth: 0,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemsContainer: {
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    marginLeft: 14,
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  dangerText: {
    color: '#FF4444',
  },
  activeText: {
    color: '#007AFF',
  },
});

export default BottomSheetMenu;
