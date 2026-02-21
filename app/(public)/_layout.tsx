import { useThemeColors } from "@/hooks/useThemeColor";
import { Stack } from "expo-router";

const Layout = () => {
    const colors = useThemeColors();
    return(
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.background,
                },
                headerTintColor: colors.text,
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false}} />
            <Stack.Screen name="signup" options={{ headerShown: false}} />
            <Stack.Screen name="verify" options={{ headerShown: false}} />
            <Stack.Screen name="login" options={{ headerShown: false}} />
            <Stack.Screen name="login/email" options={{ headerShown: false}} />
        </Stack>
    );
};

export default Layout;
