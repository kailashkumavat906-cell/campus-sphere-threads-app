import { api } from "@/convex/_generated/api";
import { useThemeColors } from "@/hooks/useThemeColor";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { Tabs, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

const CustomHeaderTitle = ({ colors }: { colors: any }) => (
  <Text
    style={{
      fontSize: 23,
      fontWeight: "700",
      textAlign: "center",
      letterSpacing: 0,
      color: colors.text,
    }}
  >
    CampusSphere
  </Text>
);

const styles = StyleSheet.create({
  createIconContainer: {
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});

const CreateTabIcon = ({ color, size }: any) => (
  <View style={[styles.createIconContainer, { backgroundColor: color }]}>
    <Ionicons name="add" size={size - 4} color="#fff" />
  </View>
);

export default function Layout() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const colors = useThemeColors();
  
  // Get unread notification count
  const unreadCount = useQuery(api.notifications.getUnreadNotificationCount) ?? 0;

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.icon,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
          headerRight: () => (
            <Pressable 
              onPress={() => router.push("/(auth)/(modal)/notifications")}
              style={{ padding: 8, marginRight: 8 }}
            >
              <View style={{ position: 'relative' }}>
                <Ionicons 
                  name="notifications-outline" 
                  size={24} 
                  color={colors.text} 
                />
                {unreadCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: '#ff3b30',
                    borderRadius: 10,
                    paddingHorizontal: 5,
                    minWidth: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{
                      color: 'white',
                      fontSize: 10,
                      fontWeight: 'bold'
                    }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "search" : "search-outline"} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          title: "Create",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <CreateTabIcon color={colors.tint} size={size} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            Haptics.selectionAsync();
            router.push("/(auth)/(modal)/create");
          },
        }}
      />

      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "heart" : "heart-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
            />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            // Always navigate to own profile when clicking the Profile tab
            e.preventDefault();
            Haptics.selectionAsync();
            // Navigate to profile without userId to show current user's profile
            router.push("/(auth)/(tabs)/profile");
          },
        }}
      />
    </Tabs>
  );
}
