import { useThemeColors } from '@/hooks/useThemeColor';
import React, { useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TabsProps = {
  onTabChange: (tab: 'Posts' | 'Replies' | 'Drafts') => void;
  initialTab?: 'Posts' | 'Replies' | 'Drafts';
  showDraftsTab?: boolean;
};

const Tabs = ({ onTabChange, initialTab = 'Posts', showDraftsTab = false }: TabsProps) => {
  const [activeTab, setActiveTab] = useState<'Posts' | 'Replies' | 'Drafts'>(initialTab);
  const [tabLayouts, setTabLayouts] = useState<{ [key: string]: { x: number; width: number } }>({});
  const colors = useThemeColors();
  
  // Animated underline position
  const translateX = useRef(new Animated.Value(0)).current;
  
  const tabs = showDraftsTab ? ['Posts', 'Replies', 'Drafts'] : ['Posts', 'Replies'];

  const handleTabLayout = (event: LayoutChangeEvent, tab: string) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts(prev => ({ ...prev, [tab]: { x, width } }));
  };

  const handleTabPress = (tab: 'Posts' | 'Replies' | 'Drafts') => {
    setActiveTab(tab);
    onTabChange(tab);
    
    const layout = tabLayouts[tab];
    if (layout) {
      // Animate underline position
      Animated.spring(translateX, {
        toValue: layout.x,
        useNativeDriver: true,
        friction: 8,
        tension: 50,
      }).start();
    }
  };

  const tabWidth = tabs.length === 3 ? '33%' : '50%';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={styles.tab}
          onLayout={(event) => handleTabLayout(event, tab)}
          onPress={() => handleTabPress(tab as 'Posts' | 'Replies' | 'Drafts')}
          activeOpacity={0.7}>
          <Text style={[
            styles.tabText,
            activeTab === tab && [styles.activeTabText, { color: colors.text }]
          ]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
      
      {/* Animated underline */}
      <Animated.View
        style={[
          styles.underline,
          {
            backgroundColor: colors.text,
            transform: [{ translateX }],
            width: tabWidth,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    position: 'relative',
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8e8e8e',
  },
  activeTabText: {
    fontWeight: '700',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});

export default Tabs;
