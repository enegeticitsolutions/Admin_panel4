/**
 * MaiHoonNa Senior Care Operations Portal - Authentication Context
 * Manages user authentication state and role-based access control (RBAC)
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, UserRole } from '../../types';
import { authApi } from '../../services/api';
import { FRONTEND_PERMISSIONS } from '../utils/permissions';



interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (phone: string, password: string, turnstileToken?: string) => Promise<void>;
  biometricLogin: (userId: string) => Promise<void>;
  logout: () => void;
  hasAccess: (requiredRole?: UserRole[]) => boolean;
  can: (permission: string) => boolean;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for saved session on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('maihonna_user');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        // The new structure has authData.user, old has authData directly as user
        setUser(authData.user || authData);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('maihonna_user');
      }
    }
  }, []);

  const login = async (phone: string, password: string, turnstileToken?: string) => {
    try {
      const authResponse = await authApi.login(phone, password, turnstileToken);
      // authResponse = { user, accessToken, refreshToken }
      setUser(authResponse.user);
      setIsAuthenticated(true);
      localStorage.setItem('maihonna_user', JSON.stringify(authResponse));
    } catch (error) {
      throw error;
    }
  };

  const biometricLogin = async (userId: string) => {
    try {
      const authResponse = await authApi.biometricLogin(userId);
      // For biometric (mock), ensure it matches structure if it returns user directly
      const userData = (authResponse as any).user || authResponse;
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('maihonna_user', JSON.stringify(authResponse));
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.clear();
    sessionStorage.clear();
  };

  /**
   * Check if current user has access based on required roles.
   * master_admin always has access to everything.
   */
  const hasAccess = (requiredRoles?: UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'master_admin') return true;
    if (!requiredRoles || requiredRoles.length === 0) return true;
    return requiredRoles.includes(user.role);
  };

  /**
   * Check if the current user's role has a given permission key.
   * Permission keys match the backend rbac.js PERMISSIONS map.
   * Client-side only — real enforcement is always on the backend.
   */
  const can = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'master_admin') return true;
    const allowedRoles = FRONTEND_PERMISSIONS[permission];
    if (!allowedRoles) return false;
    return allowedRoles.includes(user.role);
  };


  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, biometricLogin, logout, hasAccess, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
