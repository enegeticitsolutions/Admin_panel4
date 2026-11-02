import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

const request = async <T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<ApiResponse<T>> => {
  const token = (await AsyncStorage.getItem('userToken')) || (await AsyncStorage.getItem('token'));
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: any;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const error: any = new Error(data?.message || `Request failed with status ${response.status}`);
    error.response = {
      status: response.status,
      data,
    };
    throw error;
  }

  return {
    data,
    status: response.status,
    statusText: response.statusText,
  };
};

export const api = {
  get: <T = any>(endpoint: string) => request<T>(endpoint, 'GET'),
  post: <T = any>(endpoint: string, body?: any) => request<T>(endpoint, 'POST', body),
  put: <T = any>(endpoint: string, body?: any) => request<T>(endpoint, 'PUT', body),
  patch: <T = any>(endpoint: string, body?: any) => request<T>(endpoint, 'PATCH', body),
  delete: <T = any>(endpoint: string) => request<T>(endpoint, 'DELETE'),
};

export default api;
