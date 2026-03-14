import AppLoading from "@/components/AppLoading";
import { api } from "@/convex/_generated/api";
import { ThemeProvider } from "@/hooks/ThemeContext";
import { tokenCache } from "@/utils/cache";
import { getDeviceInfo } from "@/utils/device";
import { ClerkLoaded, ClerkProvider, useAuth, useUser } from "@clerk/clerk-expo";
import { ConvexReactClient, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { Href } from "expo-router";
import { Slot, useRouter, useSegments } from "expo-router";
import { ReactNode, useEffect, useState } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// ✅ FIX 1
const clerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL!,
  { unsavedChangesWarning: false }
);

LogBox.ignoreLogs([
  "Clerk: Clerk has been loaded with development keys",
]);

// Ignore all logs in production to prevent developer error messages from showing to users
LogBox.ignoreAllLogs(true);

function InitialLayout(): ReactNode {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();
  const [isAppReady, setIsAppReady] = useState(false);
  const [hasSyncedUser, setHasSyncedUser] = useState(false);

  const syncUser = useMutation(api.users.syncUser);
  const createSession = useMutation(api.sessions.createSession);

  // Wait for app to be ready
  const handleAppReady = () => {
    setIsAppReady(true);
  };

  // Sync user to Convex when signed in - only once per sign-in
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || hasSyncedUser) return;

    console.log('=== SYNCING USER TO CONVEX ===');
    console.log('user.id:', user.id);
    console.log('user.imageUrl:', user.imageUrl);
    console.log('user.primaryEmailAddress:', user.primaryEmailAddress?.emailAddress);
    console.log('user.firstName:', user.firstName);
    console.log('user.lastName:', user.lastName);
    
    // Get device info inside useEffect to avoid SSR issues
    const deviceInfo = getDeviceInfo();
    
    // Set flag immediately to prevent re-runs
    setHasSyncedUser(true);
    
    syncUser({
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress || "",
      imageUrl: user.imageUrl || undefined,
      first_name: user.firstName || undefined,
      last_name: user.lastName || undefined,
    })
      .then((result) => {
        console.log('User synced successfully, result:', result);
        
        // Create session after user is synced
        return createSession({
          clerkId: user.id,
          deviceName: deviceInfo.deviceName,
          deviceType: deviceInfo.deviceType,
          deviceInfo: deviceInfo.deviceInfo,
        });
      })
      .then((sessionResult) => {
        console.log('Session created successfully:', sessionResult);
      })
      .catch((error) => {
        console.error('Failed to sync user or create session:', error);
        // Reset flag on error to allow retry
        setHasSyncedUser(false);
      });
  }, [isLoaded, isSignedIn, user, syncUser, createSession, hasSyncedUser]);

  // ✅ AUTH GUARD (TYPED)
  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/(tabs)/feed" as Href);
    } else if (!isSignedIn) {
      const inPublicGroup = segments[0] === "(public)";
      
      if (!inPublicGroup) {
        router.replace("/" as Href);
      }
    }
  }, [isLoaded, isSignedIn, segments, router]);

  // Update session lastActive periodically when user is signed in
  const updateLastActive = useMutation(api.sessions.updateLastActiveByClerkId);
  
  useEffect(() => {
    if (!isSignedIn || !user) return;
    
    // Update lastActive every 5 minutes
    const interval = setInterval(() => {
      updateLastActive({ clerkId: user.id }).catch(console.error);
    }, 5 * 60 * 1000);
    
    // Also update immediately when the app comes to foreground
    const handleAppForeground = () => {
      updateLastActive({ clerkId: user.id }).catch(console.error);
    };
    
    return () => {
      clearInterval(interval);
    };
  }, [isSignedIn, user, updateLastActive]);

  // Show AppLoading until app is ready
  if (!isAppReady) {
    return (
      <AppLoading onFinish={handleAppReady} />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Slot />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
      appearance={{
        variables: {
          colorPrimary: '#0095F6',
          colorText: '#FFFFFF',
          colorBackground: '#0D0D0D',
          colorInputBackground: 'rgba(255, 255, 255, 0.08)',
          colorInputText: '#FFFFFF',
          fontFamily: 'DMSans_400Regular',
        },
        elements: {
          formButtonPrimary: {
            backgroundColor: '#0095F6',
            borderRadius: 25,
            height: 50,
          },
          headerTitle: {
            color: '#FFFFFF',
            fontFamily: 'DMSans_700Bold',
          },
          headerSubtitle: {
            color: 'rgba(255, 255, 255, 0.6)',
          },
          socialButtonsBlockButton: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 28,
            height: 56,
          },
          formFieldLabel: {
            color: 'rgba(255, 255, 255, 0.6)',
          },
          formFieldInput: {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderRadius: 12,
            height: 56,
            color: '#FFFFFF',
          },
          footerActionLink: {
            color: '#0095F6',
          },
          identityPreview: {
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
          },
        },
      }}
    >
      <ClerkLoaded>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ThemeProvider>
            <InitialLayout />
          </ThemeProvider>
        </ConvexProviderWithClerk>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
