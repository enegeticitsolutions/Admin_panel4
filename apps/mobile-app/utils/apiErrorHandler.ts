export const handleApiError = (
    error: any,
    showAlert: (title: string, message: string, type?: 'info' | 'success' | 'error' | 'warning') => void,
    defaultMessage: string = "We're having trouble connecting right now. Please try again later."
) => {
    console.error("API Error caught by global handler:", error);

    let message = defaultMessage;
    let title = "Something went wrong";

    if (__DEV__) {
        // In development, show detailed errors if available
        message = error?.response?.data?.message 
                  || error?.message 
                  || JSON.stringify(error);
        title = `Error ${error?.response?.status || ''}`.trim();
    } else {
        // In production, sanitize the error
        if (!error.response) {
            // Network error (no response)
            message = "Please check your internet connection and try again.";
            title = "Network Error";
        } else if (error.response.status >= 500) {
            // Server error
            message = "Our servers are currently busy. Please try again later.";
        } else if (error.response.status === 401 || error.response.status === 403) {
            // Auth error
            message = "Your session has expired. Please log in again.";
            title = "Authentication Error";
        } else if (error.response.status === 400 || error.response.status === 422) {
            // Validation or client error - we might want to show the specific message here
            // if the backend sends user-friendly messages for these
            const backendMsg = error.response.data?.message;
            if (backendMsg && typeof backendMsg === 'string' && backendMsg.length < 100) {
                 message = backendMsg;
            }
        }
    }

    showAlert(title, message, 'error');
};
