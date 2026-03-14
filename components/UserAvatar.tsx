import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type UserAvatarProps = {
  user?: {
    imageUrl?: string;
    isOnline?: boolean;
    showOnlineStatus?: boolean;
  };
  size?: number;
  placeholderText?: string;
};

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  user, 
  size = 40,
  placeholderText 
}) => {
  const showOnlineIndicator = user?.isOnline === true && user?.showOnlineStatus === true;
  
  // Debug logging
  if (user) {
    console.log('[UserAvatar] Rendering avatar:', {
      hasImage: !!user.imageUrl,
      isOnline: user.isOnline,
      showOnlineStatus: user.showOnlineStatus,
      showIndicator: showOnlineIndicator,
      placeholder: placeholderText
    });
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {user?.imageUrl ? (
        <Image
          source={{ uri: user.imageUrl }}
          style={[
            styles.avatar, 
            { width: size, height: size, borderRadius: size / 2 }
          ]}
        />
      ) : (
        <View style={[
          styles.placeholder, 
          { width: size, height: size, borderRadius: size / 2 }
        ]}>
          {/* Placeholder - could add text here if needed */}
        </View>
      )}
      
      {/* Online Indicator */}
      {showOnlineIndicator && (
        <View 
          style={[
            styles.onlineIndicator, 
            { 
              width: size * 0.3, 
              height: size * 0.3, 
              borderRadius: size * 0.15,
              borderWidth: size * 0.05,
            }
          ]} 
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatar: {
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: '#ccc',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#22c55e',
    borderColor: '#fff',
  },
});
