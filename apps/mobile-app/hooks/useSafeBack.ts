import { useNavigationStack } from '../contexts/NavigationStackContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * A custom hook that provides a safe way to go back in navigation.
 * Uses the global NavigationStackContext to track logical history.
 */
export function useSafeBack() {
    const { pop } = useNavigationStack();
    const { isLoggedIn, role } = useAuth();

    const safeBack = (fallbackRoute?: string) => {
        let route = fallbackRoute;
        if (!route || route === '/') {
            if (isLoggedIn) {
                route = role === 'beneficiary' ? '/(beneficiary)' : role === 'care_companion' ? '/(care-companion)' : '/(subscriber)';
            } else {
                route = '/';
            }
        }
        pop(route);
    };

    return safeBack;
}
