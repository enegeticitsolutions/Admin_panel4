import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'expo-router';

export type RouteState = { pathname: string; params?: any };

interface NavigationStackContextType {
  stack: RouteState[];
  push: (pathname: string | { pathname: string, params?: any }, params?: any) => void;
  pop: (fallback?: string) => boolean;
  replace: (pathname: string | { pathname: string, params?: any }, params?: any) => void;
  resetStack: () => void;
  canGoBack: () => boolean;
}

const NavigationStackContext = createContext<NavigationStackContextType | undefined>(undefined);

export function NavigationStackProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<RouteState[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const historyRef = useRef<string[]>([]);
  const isPoppingRef = useRef(false);

  // Automatically record every visited route so back navigation always knows the real previous page
  useEffect(() => {
    if (!pathname) return;
    if (isPoppingRef.current) {
      isPoppingRef.current = false;
      return;
    }
    const hist = historyRef.current;
    if (hist[hist.length - 1] !== pathname) {
      hist.push(pathname);
      if (hist.length > 50) {
        hist.shift();
      }
    }
  }, [pathname]);

  const push = useCallback((pathnameArg: string | { pathname: string, params?: any }, params?: any) => {
    const path = typeof pathnameArg === 'string' ? pathnameArg : pathnameArg.pathname;
    const p = typeof pathnameArg === 'string' ? params : pathnameArg.params;
    setStack(prev => [...prev, { pathname: path, params: p }]);
    if (typeof pathnameArg === 'string') {
      router.push({ pathname: path, params: p } as any);
    } else {
      router.push(pathnameArg as any);
    }
  }, [router]);

  const replace = useCallback((pathnameArg: string | { pathname: string, params?: any }, params?: any) => {
    const path = typeof pathnameArg === 'string' ? pathnameArg : pathnameArg.pathname;
    const p = typeof pathnameArg === 'string' ? params : pathnameArg.params;
    setStack(prev => {
      const newStack = [...prev];
      if (newStack.length > 0) {
        newStack[newStack.length - 1] = { pathname: path, params: p };
      } else {
        newStack.push({ pathname: path, params: p });
      }
      return newStack;
    });
    if (typeof pathnameArg === 'string') {
      router.replace({ pathname: path, params: p } as any);
    } else {
      router.replace(pathnameArg as any);
    }
  }, [router]);

  const pop = useCallback((fallback?: string) => {
    setStack(prev => {
      if (prev.length > 0) {
        const newStack = [...prev];
        newStack.pop();
        return newStack;
      }
      return prev;
    });

    const hist = historyRef.current;
    const hasPreviousInHistory = hist.length > 1;
    let previousRoute: string | undefined;
    if (hasPreviousInHistory) {
      hist.pop(); // remove current route
      previousRoute = hist[hist.length - 1];
    }

    if (router.canGoBack()) {
      isPoppingRef.current = true;
      router.back();
      return true;
    } else if (previousRoute) {
      isPoppingRef.current = true;
      router.replace(previousRoute as any);
      return true;
    } else if (fallback) {
      isPoppingRef.current = true;
      router.replace(fallback as any);
      return true;
    }

    return false;
  }, [router]);

  const resetStack = useCallback(() => {
    setStack([]);
    historyRef.current = pathname ? [pathname] : [];
  }, [pathname]);

  const canGoBack = useCallback(() => {
    return router.canGoBack() || stack.length > 0 || historyRef.current.length > 1;
  }, [router, stack]);

  return (
    <NavigationStackContext.Provider value={{ stack, push, pop, replace, resetStack, canGoBack }}>
      {children}
    </NavigationStackContext.Provider>
  );
}

export function useNavigationStack() {
  const context = useContext(NavigationStackContext);
  if (!context) {
    throw new Error('useNavigationStack must be used within a NavigationStackProvider');
  }
  return context;
}
