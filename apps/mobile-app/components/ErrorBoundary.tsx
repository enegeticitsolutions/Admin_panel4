import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '@/utils/responsive';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Here you would log the error to a reporting service like Sentry or Crashlytics
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView style={styles.container}>
                    <View style={styles.content}>
                        <Ionicons name="warning" size={scale(64)} color="#F59E0B" />
                        <Text style={styles.title}>Oops! Something went wrong.</Text>
                        <Text style={styles.message}>
                            {__DEV__ 
                                ? this.state.error?.toString() 
                                : 'We encountered an unexpected error. Our team has been notified. Please try again later.'}
                        </Text>
                        <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                            <Text style={styles.buttonText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
    },
    title: {
        fontSize: scale(22),
        fontWeight: 'bold',
        color: '#111827',
        marginTop: scale(20),
        marginBottom: scale(10),
        textAlign: 'center',
    },
    message: {
        fontSize: scale(15),
        color: '#4B5563',
        textAlign: 'center',
        marginBottom: scale(30),
        lineHeight: scale(22),
    },
    button: {
        backgroundColor: '#F97316',
        paddingVertical: scale(14),
        paddingHorizontal: scale(32),
        borderRadius: scale(12),
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: scale(16),
        fontWeight: 'bold',
    },
});
