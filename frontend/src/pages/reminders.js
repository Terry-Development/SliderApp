import { useState, useEffect } from 'react';
import Head from 'next/head';
import Navbar from '../components/Navbar';
import { urlBase64ToUint8Array } from '../utils/urlBase64ToUint8Array';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function Reminders() {
    const [reminders, setReminders] = useState([]);
    const [message, setMessage] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [repeatValue, setRepeatValue] = useState('');
    const [repeatUnit, setRepeatUnit] = useState('1'); // 1=min, 60=hour, 1440=day
    const [isRepeating, setIsRepeating] = useState(false);
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

    const handleTestPush = async () => {
        try {
            alert('Sending Test Push...');
            const res = await fetch(`${API_URL}/test-notification`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await res.json();

            if (!res.ok) {
                alert(`Failed: ${data.error || 'Unknown error'}`);
                return;
            }

            alert(`Result: Sent ${data.sent}, Failed ${data.failed}`);
        } catch (err) {
            alert(`Network Error: ${err.message}`);
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

    const handleTroubleshoot = async () => {
        let logs = [];
        const log = (msg) => logs.push(msg);

        try {
            log('--- CLIENT CHECKS ---');
            log(`Browser: ${navigator.userAgent}`);
            log(`Notifications Supported: ${'Notification' in window}`);
            log(`Service Worker Supported: ${'serviceWorker' in navigator}`);
            log(`Push Manager Supported: ${'PushManager' in window}`);
            log(`Notification Permission: ${Notification.permission}`);

            if (Notification.permission === 'denied') {
                throw new Error('Notifications are blocked by browser settings!');
            }

            const reg = await navigator.serviceWorker.getRegistration();
            log(`SW Registration: ${reg ? 'Found' : 'MISSING'}`);
            if (reg) {
                log(`SW State: ${reg.active ? 'Active' : (reg.waiting ? 'Waiting' : 'Installing')}`);
                const sub = await reg.pushManager.getSubscription();
                log(`Push Subscription: ${sub ? 'Present' : 'MISSING (Click Enable)'}`);
            }

            log('\n--- SERVER CHECKS ---');
            try {
                const start = Date.now();
                const res = await fetch(`${API_URL}/debug-status`);
                const latency = Date.now() - start;

                if (!res.ok) {
                    throw new Error(`Server returned HTTP ${res.status}`);
                }

                const text = await res.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    log(`Response not JSON: ${text.substring(0, 50)}...`);
                    throw new Error('Invalid JSON from server (Deployment in progress?)');
                }

                log(`Server Connectivity: OK (${latency}ms)`);
                log(`Server Time: ${new Date(data.serverTime).toLocaleTimeString()}`);
                log(`Client Time: ${new Date().toLocaleTimeString()}`);
                log(`Registered Subs on Server: ${data.subscriptionCount}`);

                // Time Drift Check
                const serverTime = new Date(data.serverTime).getTime();
                const clientTime = Date.now();
                const diff = Math.abs(serverTime - clientTime);
                log(`Time Drift: ${Math.round(diff / 1000)}s`);

                if (diff > 60000) log('WARNING: Large time drift detected!');

            } catch (err) {
                log(`Server Error: ${err.message}`);
            }

            alert(logs.join('\n'));

        } catch (e) {
            alert(`TROUBLESHOOT FAILED:\n${e.message}\n\nLogs:\n${logs.join('\n')}`);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);

        const calculatedInterval = isRepeating && repeatValue
            ? parseInt(repeatValue) * parseInt(repeatUnit)
            : 0;

        // Combine Date and Time
        const scheduledTime = new Date(`${date}T${time}`);

        try {
            const res = await fetch(`${API_URL}/reminders`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    message,
                    time: scheduledTime.toISOString(),
                    repeatInterval: calculatedInterval
                })
            });

            if (res.ok) {
                setMessage('');
                setDate('');
                setTime('');
                setRepeatValue('');
                setIsRepeating(false);
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

    const handleToggle = async (id, currentStatus) => {
        try {
            await fetch(`${API_URL}/reminders/${id}/toggle`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ isActive: !currentStatus })
            });
            fetchReminders();
        } catch (err) {
            console.error(err);
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

    // Helper to format interval for display
    const formatInterval = (mins) => {
        if (!mins) return '';
        if (mins % 1440 === 0) return `Every ${mins / 1440} Day(s)`;
        if (mins % 60 === 0) return `Every ${mins / 60} Hour(s)`;
        return `Every ${mins} Minute(s)`;
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
                            onClick={handleTroubleshoot}
                            className="px-3 py-2 text-xs bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 rounded-lg transition-colors"
                        >
                            Troubleshoot
                        </button>
                        <button
                            onClick={subscribeToPush}
                            className="btn-gradient px-4 py-2 text-sm"
                        >
                            {permission === 'granted' ? 'Re-Subscribe' : 'Enable Notifications'}
                        </button>
                        <button
                            onClick={handleTestPush}
                            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10"
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
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Date & Time</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full sm:flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-white [color-scheme:dark]"
                                        required
                                    />
                                    <input
                                        type="time"
                                        value={time}
                                        onChange={(e) => setTime(e.target.value)}
                                        className="w-full sm:w-32 bg-black/40 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-white [color-scheme:dark]"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Repeat</label>
                                <select
                                    value={isRepeating ? 'custom' : 'no'}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'no') {
                                            setIsRepeating(false);
                                            setRepeatValue('');
                                        } else {
                                            setIsRepeating(true);
                                        }
                                    }}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-white"
                                >
                                    <option value="no">Never</option>
                                    <option value="custom">Enable Repeat...</option>
                                </select>
                            </div>
                        </div>

                        {/* Custom Repeating Panel */}
                        {isRepeating && (
                            <div className="bg-white/5 p-4 rounded-lg border border-white/10 animate-fade-in-down">
                                <label className="block text-sm text-gray-400 mb-2 font-medium text-blue-400">Repeat Every...</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        value={repeatValue}
                                        onChange={(e) => setRepeatValue(e.target.value)}
                                        className="w-24 bg-black/40 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-center"
                                        placeholder="1"
                                        required={isRepeating}
                                    />
                                    <select
                                        value={repeatUnit}
                                        onChange={(e) => setRepeatUnit(e.target.value)}
                                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-white"
                                    >
                                        <option value="1">Minutes</option>
                                        <option value="60">Hours</option>
                                        <option value="1440">Days</option>
                                    </select>
                                </div>
                            </div>
                        )}

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
                    <h2 className="text-xl font-semibold">Active Reminders</h2>
                    {reminders.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No active reminders</p>
                    ) : (
                        reminders.map(reminder => (
                            <div key={reminder.id} className={`bg-white/5 rounded-xl p-4 border flex items-center justify-between group transition-all ${reminder.isActive !== false ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className={`font-medium text-lg ${reminder.isActive !== false ? 'text-white' : 'text-gray-500 line-through'}`}>{reminder.message}</p>
                                        {reminder.repeatInterval > 0 && (
                                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                                                {formatInterval(reminder.repeatInterval)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-400">
                                        {reminder.repeatInterval > 0 ? 'Next: ' : ''}
                                        {new Date(reminder.time).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => handleToggle(reminder.id, reminder.isActive ?? true)}
                                        className={`w-12 h-6 rounded-full p-1 transition-colors ${reminder.isActive !== false ? 'bg-green-500' : 'bg-gray-600'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${reminder.isActive !== false ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>

                                    <button
                                        onClick={() => handleDelete(reminder.id)}
                                        className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
