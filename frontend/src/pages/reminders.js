import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
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
    const [showDebug, setShowDebug] = useState(false);

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

                if (sub) {
                    log('Attempting to Re-Sync Subscription...');
                    try {
                        await fetch(`${API_URL}/subscribe`, {
                            method: 'POST',
                            body: JSON.stringify(sub),
                            headers: { 'Content-Type': 'application/json' }
                        });
                        log('Re-Sync Success: Server updated.');
                    } catch (e) {
                        log(`Re-Sync Failed: ${e.message}`);
                    }
                }
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
                log(`Storage System: ${data.storageStatus}`);

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
        // Optimistic UI Update: Immediately toggle state
        setReminders(prev => prev.map(r =>
            r.id === id ? { ...r, isActive: !currentStatus } : r
        ));

        try {
            await fetch(`${API_URL}/reminders/${id}/toggle`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ isActive: !currentStatus })
            });
            // No need to refetch, state is already correct
        } catch (err) {
            console.error(err);
            // Revert on error
            setReminders(prev => prev.map(r =>
                r.id === id ? { ...r, isActive: currentStatus } : r
            ));
            alert('Failed to update status');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Reminder?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
            background: '#1a1a1a',
            color: '#fff'
        });

        if (result.isConfirmed) {
            // Optimistic Update: Remove immediately
            const previousReminders = [...reminders];
            setReminders(prev => prev.filter(r => r.id !== id));

            try {
                const res = await fetch(`${API_URL}/reminders/${id}`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });

                if (!res.ok) throw new Error('Failed to delete');

                Swal.fire({
                    title: 'Deleted!',
                    text: 'Your reminder has been deleted.',
                    icon: 'success',
                    background: '#1a1a1a',
                    color: '#fff',
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (err) {
                console.error(err);
                // Revert
                setReminders(previousReminders);
                Swal.fire({
                    title: 'Error',
                    text: 'Failed to delete reminder.',
                    icon: 'error',
                    background: '#1a1a1a',
                    color: '#fff'
                });
            }
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
        <div className="min-h-screen bg-dark-bg text-white font-sans selection:bg-primary/30 pb-20">
            <Head>
                <title>Reminders | SliderApp</title>
            </Head>

            <Navbar />

            <main className="pt-28 max-w-3xl mx-auto px-4 md:px-6">
                {/* Header Section */}
                <header className="mb-10 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 pb-1">
                                Reminders
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">Never miss a moment</p>
                        </div>

                        {/* Developer Tools Toggle */}
                        <button
                            onClick={() => setShowDebug(!showDebug)}
                            className={`p-2 rounded-full transition-all duration-300 ${showDebug ? 'bg-white/10 text-white rotate-90' : 'text-white/20 hover:text-white/60'}`}
                            title="Developer Options"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>

                    {/* Developer Tools Panel (Hidden by default) */}
                    {showDebug && (
                        <div className="flex flex-wrap gap-2 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                            <button
                                onClick={handleTroubleshoot}
                                className="px-3 py-1.5 text-xs font-semibold bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span>🔧</span> Troubleshoot
                            </button>
                            <button
                                onClick={handleTestPush}
                                className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <span>🔔</span> Test Push
                            </button>
                            <button
                                onClick={subscribeToPush}
                                className={`px-3 py-1.5 text-xs font-semibold border rounded-lg transition-colors ${permission === 'granted' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-blue-600 text-white border-transparent'}`}
                            >
                                {permission === 'granted' ? '♻️ Re-Subscribe' : '✅ Enable Notifications'}
                            </button>
                        </div>
                    )}

                    {!showDebug && permission !== 'granted' && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                            <span className="text-sm text-blue-200">Get notified about new uploads</span>
                            <button
                                onClick={subscribeToPush}
                                className="px-4 py-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                            >
                                Enable
                            </button>
                        </div>
                    )}
                </header>

                {/* Main Content Grid */}
                <div className="flex flex-col gap-10">

                    {/* Left Column: Create Form */}
                    <div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-6 md:p-8 sticky top-28">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <span className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-sm font-bold uppercase tracking-wide">
                                    {new Date().toLocaleDateString('en-US', { weekday: 'short' })}
                                </span>
                                New Reminder
                            </h2>

                            <form onSubmit={handleCreate} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider pl-1">Message</label>
                                    <input
                                        type="text"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                                        placeholder="What needs to be done?"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider pl-1">Date</label>
                                        <input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all [color-scheme:dark]"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider pl-1">Time</label>
                                        <input
                                            type="time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all [color-scheme:dark]"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider pl-1">Repetition</label>
                                    <div className="p-1 bg-black/30 rounded-xl border border-white/5 flex">
                                        <button
                                            type="button"
                                            onClick={() => { setIsRepeating(false); setRepeatValue(''); }}
                                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isRepeating ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            Once
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsRepeating(true)}
                                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isRepeating ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            Repeat
                                        </button>
                                    </div>
                                </div>

                                {/* Custom Repeating Panel */}
                                {isRepeating && (
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 animate-fade-in space-y-3">
                                        <p className="text-sm text-center text-primary font-medium">Repeat Every...</p>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={repeatValue}
                                                onChange={(e) => setRepeatValue(e.target.value)}
                                                className="w-20 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-center text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                placeholder="1"
                                                required={isRepeating}
                                            />
                                            <select
                                                value={repeatUnit}
                                                onChange={(e) => setRepeatUnit(e.target.value)}
                                                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                                    className="w-full btn-gradient py-3.5 rounded-xl font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                >
                                    {loading ? 'Scheduling...' : 'Set Reminder'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Right Column: List */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Upcoming</h2>
                            <span className="text-xs font-medium px-2 py-1 bg-white/10 rounded-lg text-slate-300">{reminders.length} Active</span>
                        </div>

                        {/* List Items */}
                        <div className="space-y-4">
                            {reminders.length === 0 ? (
                                <div className="text-center py-20 px-6 rounded-3xl bg-white/5 border border-white/5 border-dashed">
                                    <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center text-3xl mb-4">
                                        🍃
                                    </div>
                                    <h3 className="text-lg font-medium text-white mb-1">No reminders yet</h3>
                                    <p className="text-slate-500 text-sm">Add tasks you don't want to forget.</p>
                                </div>
                            ) : (
                                reminders.map(reminder => (
                                    <div
                                        key={reminder.id}
                                        className={`group relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${reminder.isActive !== false ? 'bg-white/5 backdrop-blur-md border-white/10 hover:border-white/20 hover:bg-white/10' : 'bg-black/20 border-white/5 grayscale opacity-60'}`}
                                    >
                                        {/* Repeating Badge */}
                                        {reminder.repeatInterval > 0 && (
                                            <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-bl-2xl border-b border-l border-white/5">
                                                <span className="text-[10px] font-bold tracking-wider text-blue-300 uppercase">
                                                    {formatInterval(reminder.repeatInterval)}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex flex-col sm:flex-row sm:items-center gap-5 justify-between relative z-10">
                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-3 mb-1">
                                                    <h3 className={`font-semibold text-lg truncate ${reminder.isActive !== false ? 'text-white' : 'text-slate-400 decoration-slate-600 line-through'}`}>
                                                        {reminder.message}
                                                    </h3>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                    <span>
                                                        {new Date(reminder.time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-white/5 mt-4 sm:mt-0">
                                                {/* Toggle Switch */}
                                                <button
                                                    onClick={() => handleToggle(reminder.id, reminder.isActive ?? true)}
                                                    className={`relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-offset-2 focus:ring-offset-black focus:ring-2 ${reminder.isActive !== false ? 'bg-gradient-to-r from-green-500 to-emerald-400 focus:ring-green-500' : 'bg-slate-700/50 focus:ring-slate-500'}`}
                                                    title="Toggle Active"
                                                >
                                                    <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 transform ${reminder.isActive !== false ? 'translate-x-7 scale-110' : 'translate-x-0'}`} />
                                                </button>

                                                {/* Delete Button */}
                                                <button
                                                    onClick={() => handleDelete(reminder.id)}
                                                    className="p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                                                    title="Delete"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
