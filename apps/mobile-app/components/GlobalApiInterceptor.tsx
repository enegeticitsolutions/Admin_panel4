import React, { useEffect, ReactNode } from 'react';
import { useCustomAlert } from '@/contexts/CustomAlertContext';

// Save the original fetch reference
const originalFetch = global.fetch;

export function GlobalApiInterceptor({ children }: { children: ReactNode }) {
    const { showAlert } = useCustomAlert();

    useEffect(() => {
        // The user specifically requested this to apply only when the app is in production
        // In development, we want developers to see the real console errors and crashes
        if (__DEV__) return;

        global.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                
                // If the response is not OK, let's see if it's a backend/server error
                if (!response.ok) {
                    if (response.status >= 500) {
                        // 500+ errors are Server Errors, Backend Errors, etc.
                        // We mask these with a polite message.
                        showAlert(
                            'Something went wrong', 
                            'We encountered an unexpected error. Please try again later.', 
                            'error'
                        );
                    }
                    // For 4xx (Client Errors), we let them pass through because they are often
                    // handled locally (e.g., "Invalid Password" or "Email already in use").
                }
                
                return response;
            } catch (error) {
                // This catches true network failures (e.g., no internet connection)
                showAlert(
                    'Network Error', 
                    'Please check your internet connection and try again.', 
                    'error'
                );
                // We still throw the error so the calling function's catch block executes
                // and stops any local loading spinners.
                throw error;
            }
        };

        return () => {
            // Cleanup on unmount (though this provider rarely unmounts)
            global.fetch = originalFetch;
        };
    }, [showAlert]);

    return <>{children}</>;
}
