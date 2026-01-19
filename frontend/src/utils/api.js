export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const getAuthHeaders = () => {
    const password = typeof window !== 'undefined' ? localStorage.getItem('admin_password') : '';
    return {
        'Content-Type': 'application/json',
        'x-admin-password': password
    };
};
