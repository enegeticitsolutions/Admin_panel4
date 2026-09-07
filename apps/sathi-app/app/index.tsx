import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Root entry point — always shows the splash carousel first,
 * then the splash screen handles navigation to auth or main app.
 */
export default function Index() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  // Always show the splash carousel on app launch
  return <Redirect href="/splash" />;
}
