import { useState, useEffect } from 'react';
import Head from 'next/head';
import Navbar from '../components/Navbar';
import { urlBase64ToUint8Array } from '../utils/urlBase64ToUint8Array';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function Reminders() {
    const [reminders, setReminders] = useState([]);
    const [message, setMessage] = useState('');
    const [datetime, setDatetime] = useState('');
    const [permission, setPermission] = useState('default');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
        fetchReminders();
    }, []);

    const getAuthHeaders = () => {
        const password = typeof window !== 'undefined' ? localStorage.getItem('admin_password') : '';
        return {
            'Content-Type': 'application/json',
            'x-admin-password': password
        };
    };

    const fetchReminders = async () => {
        try {
            const res = await fetch(`${API_URL}/reminders`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setReminders(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const subscribeToPush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            alert('Push messaging is not supported in this browser.');
            return;
        }

        if (!VAPID_PUBLIC_KEY) {
            alert('Error: Missing VAPID Public Key in Frontend Environment.');
            return;
        }

        const confirmReset = confirm('This will reset your notification settings. Continue?');
        if (!confirmReset) return;

        try {
            alert('Step 1: Checking Service Worker...');

            // Try to find existing registration
            let registration = await navigator.serviceWorker.getRegistration();

            if (!registration) {
                alert('No Service Worker found. Attempting to register...');
                try {
                    // Fallback to registering push-sw.js directly if standard sw.js fails/timeouts
                    alert('Registering /push-sw.js directly...');
                    registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });

                    if (registration.installing) alert('SW Status: Installing');
                    else if (registration.waiting) alert('SW Status: Waiting');
                    else if (registration.active) alert('SW Status: Active');

                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (regError) {
                    throw new Error(`SW Registration Failed: ${regError.message}`);
                }
            }

            if (!registration) {
                throw new Error('Could not get Service Worker registration.');
            }

            // Wait for it to be ready, but with timeout
            alert('Waiting for Service Worker to be ready...');
            const readyPromise = navigator.serviceWorker.ready;
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timed out. Please check if /push-sw.js exists or Console logs.')), 5000)
            );

            registration = await Promise.race([readyPromise, timeoutPromise]);

            alert('Step 2: Checking Subscriptions...');
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
                alert('Removing old existing subscription...');
                await existingSub.unsubscribe();
            }

            alert('Step 3: Creating new subscription...');
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            alert('Step 4: Sending to server...');
            const res = await fetch(`${API_URL}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });

            if (res.ok) {
                alert('Success! Notifications enabled.');
                window.location.reload(); // Reload to refresh state
            } else {
                alert('Server failed to save subscription. Check Vercel/Render logs.');
            }

        } catch (error) {
            console.error('Failed to subscribe:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const requestPermission = async () => {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            subscribeToPush();
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/reminders`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ message, time: datetime })
            });

            if (res.ok) {
                setMessage('');
                setDatetime('');
                fetchReminders();
                alert('Reminder set');
            } else {
                alert('Failed to set reminder');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete reminder?')) return;
        try {
            await fetch(`${API_URL}/reminders/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            fetchReminders();
        } catch (err) {
            console.error(err);
        }
    };

    const handleTestPush = async () => {
        try {
            alert('Requesting test notification...');
            const res = await fetch(`${API_URL}/test-notification`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Test Sent! Success: ${data.sent}, Failed: ${data.failed}`);
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert(`Network Error: ${err.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-dark-bg text-white font-sans selection:bg-primary/30">
            <Head>
                <title>Reminders | SliderApp</title>
            </Head>

            <Navbar />

            <main className="pt-24 max-w-2xl mx-auto px-4 pb-12">
                <header className="mb-8 flex items-center justify-between">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                        Reminders
                    </h1>
                    <div className="flex gap-2">
                        <button
                            onClick={subscribeToPush}
                            className="btn-gradient px-4 py-2 text-sm"
                        >
                            {permission === 'granted' ? 'Re-Subscribe' : 'Enable Notifications'}
                        </button>
                        <button
                            onClick={handleTestPush}
                            className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-sm rounded-lg transition-colors border border-white/10"
                        >
                            Test Push
                        </button>
                    </div>
                </header>

                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 mb-8">
                    <h2 className="text-xl font-semibold mb-4">New Reminder</h2>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Message</label>
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors"
                                placeholder="e.g. Check the gallery"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Time</label>
                            <input
                                type="datetime-local"
                                value={datetime}
                                onChange={(e) => setDatetime(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-white calendar-picker-indicator:invert"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-gradient py-3 rounded-lg font-medium"
                        >
                            {loading ? 'Scheduling...' : 'Set Reminder'}
                        </button>
                    </form>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Upcoming</h2>
                    {reminders.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No active reminders</p>
                    ) : (
                        reminders.map(reminder => (
                            <div key={reminder.id} className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between group hover:border-white/20 transition-all">
                                <div>
                                    <p className="font-medium text-lg">{reminder.message}</p>
                                    <p className="text-sm text-gray-400">
                                        {new Date(reminder.time).toLocaleString()}
                                    </p>
                                    {reminder.sent && <span className="text-xs text-green-400">Sent</span>}
                                </div>
                                <button
                                    onClick={() => handleDelete(reminder.id)}
                                    className="p-2 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
