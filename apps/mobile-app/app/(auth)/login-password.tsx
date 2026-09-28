import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

import { API_URL } from '@/constants/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStack } from '@/contexts/NavigationStackContext';
import { useAndroidBackHandler } from '@/hooks/useAndroidBackHandler';

export default function LoginPasswordScreen() {
    const [form, setForm] = useState({
        phone: "",
        password: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { push, replace, pop, resetStack } = useNavigationStack();
    useAndroidBackHandler();
    const { login } = useAuth();

    const handleLogin = async () => {
        if (form.phone.length !== 10) {
            Alert.alert("Invalid input", "Please enter a valid 10-digit phone number.");
            return;
        }
        if (!form.password) {
            Alert.alert("Missing Fields", "Please enter your password.");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/auth/login-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: `+91${form.phone}`,
                    password: form.password
                }),
            });

            const data = await response.json();

            if (data.success) {
                const result = data.data;
                // Save session via AuthContext
                await login(result.token, result.user);
                resetStack();
                
                // Route explicitly to the correct dashboard to avoid layout flicker
                const role = result.user.role;
                if (role === "care_companion") {
                    replace("/(care-companion)");
                } else if (role === "beneficiary") {
                    replace("/(beneficiary)");
                } else {
                    replace("/(subscriber)");
                }
            } else {
                Alert.alert("Login Failed", data.message || "Invalid credentials.");
            }
        } catch (error) {
            console.error("Login Error:", error);
            Alert.alert("Network Error", "Could not connect to the backend server.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in with your password.</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <View style={styles.phoneRow}>
                            <Text style={styles.countryCode}>+91</Text>
                            <TextInput
                                style={styles.phoneInput}
                                placeholder="10-digit mobile number"
                                placeholderTextColor="#999"
                                keyboardType="numeric"
                                maxLength={10}
                                value={form.phone}
                                onChangeText={(text) => setForm({ ...form, phone: text })}
                                editable={!isLoading}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your password"
                            placeholderTextColor="#999"
                            secureTextEntry
                            value={form.password}
                            onChangeText={(text) => setForm({ ...form, password: text })}
                            editable={!isLoading}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Log In</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => push("/(auth)/register")}
                        disabled={isLoading}
                    >
                        <Text style={styles.secondaryButtonText}>Don't have an account? Sign Up</Text>
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
    container: { flex: 1, padding: 24, justifyContent: "center" },
    header: { marginBottom: 30, alignItems: "center" },
    title: { fontSize: 28, fontWeight: "700", color: "#111827", marginBottom: 8 },
    subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center" },
    card: { backgroundColor: "#FFF5ED", padding: 24, borderRadius: 16 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 13, color: "#4B5563", marginBottom: 8, fontWeight: "500" },
    input: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#F3F4F6",
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: "#111827",
    },
    phoneRow: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        alignItems: "center",
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "#F3F4F6",
    },
    countryCode: { fontSize: 16, color: "#111827", marginRight: 8, fontWeight: "500" },
    phoneInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: "#111827" },
    primaryButton: {
        backgroundColor: "#FBA56B",
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 10,
    },
    primaryButtonDisabled: { backgroundColor: "#FDBA8C" },
    primaryButtonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 16 },
    secondaryButton: { marginTop: 20, alignItems: "center" },
    secondaryButtonText: { color: "#F97316", fontWeight: "500", fontSize: 14 },
});
