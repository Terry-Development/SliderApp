import { useState, useEffect } from 'react';
import { API_URL } from '@/utils/api';

export default function AuthWrapper({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem('admin_password');
        if (stored) {
            verifyPassword(stored);
        } else {
            setLoading(false);
        }
    }, []);

    const verifyPassword = async (pwd) => {
        try {
            const res = await fetch(`${API_URL}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem('admin_password', pwd);
                setIsAuthenticated(true);
            } else {
                setError('Invalid password');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        verifyPassword(password);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center">
                <div className="animate-pulse text-slate-400">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center px-4">
                {/* Lock Icon */}
                <div className="mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-primary mb-2">SliderApp</h1>
                <p className="text-slate-500 mb-8">Protected Gallery Access</p>

                {/* Login Card */}
                <div className="w-full max-w-md card-dark p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wide">
                                Password
                            </label>
                            <input
                                type="password"
                                className="input-dark"
                                placeholder="Enter access code"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <p className="text-red-400 text-sm">{error}</p>
                        )}

                        <button type="submit" className="w-full btn-gradient flex items-center justify-center gap-2">
                            Enter Gallery
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="mt-8 text-slate-600 text-sm">© 2026 SliderApp</p>
            </div>
        );
    }

    return <>{children}</>;
}
