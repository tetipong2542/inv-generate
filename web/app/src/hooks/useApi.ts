import { useState, useCallback } from 'react';
import type { ApiResponse } from '@/types';

const API_BASE = 'http://localhost:3001/api';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async <T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'เกิดข้อผิดพลาด');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(<T>(endpoint: string) => 
    request<T>(endpoint, { method: 'GET' }), [request]);

  const post = useCallback(<T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }), [request]);

  const put = useCallback(<T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }), [request]);

  const del = useCallback(<T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }), [request]);

  const patch = useCallback(<T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }), [request]);

  return { loading, error, get, post, put, del, patch, setError };
}
