import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthWrapper from '@/components/AuthWrapper';
import Navbar from '@/components/Navbar';
import PersonPicker from '@/components/PersonPicker';
import { FEATURE_API_URL } from '@/utils/api';
import { PEOPLE, getStoredIdentity, personHeaders } from '@/utils/identity';

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

function parseMonth(value) {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1);
}

function shiftMonth(value, offset) {
    const d = parseMonth(value);
    d.setMonth(d.getMonth() + offset);
    return monthKey(d);
}

function monthTitle(value) {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(parseMonth(value));
}

function longDate(value) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        .format(new Date(`${value}T00:00:00`));
}

function eventTime(event) {
    if (event.allDay) return 'All day';
    return `${event.startTime} – ${event.endTime}`;
}

const emptyForm = (date) => ({
    title: '',
    date,
    allDay: false,
    startTime: '09:00',
    endTime: '10:00',
    status: 'busy',
    notes: ''
});

export default function CalendarPage() {
    const [identity, setIdentity] = useState('');
    const [month, setMonth] = useState(monthKey());
    const [selectedDate, setSelectedDate] = useState(dateKey());
    const [events, setEvents] = useState([]);
    const [filter, setFilter] = useState('all');
    const [form, setForm] = useState(emptyForm(dateKey()));
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => setIdentity(getStoredIdentity()), []);

    const monthStart = `${month}-01`;
    const monthDate = parseMonth(month);
    const lastDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    const monthEnd = dateKey(lastDate);
    const daysInMonth = lastDate.getDate();
    const firstWeekday = monthDate.getDay();

    const loadSchedule = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${FEATURE_API_URL}/schedule?start=${monthStart}&end=${monthEnd}`, {
                headers: personHeaders(identity),
                cache: 'no-store'
            });
            const data = await res.json().catch(() => []);
            if (!res.ok) throw new Error(data.error || 'Could not load schedule');
            setEvents(Array.isArray(data) ? data : []);
            setError('');
        } catch (err) {
            setError(err.message || 'Could not load schedule');
        } finally {
            setLoading(false);
        }
    }, [identity, monthStart, monthEnd]);

    useEffect(() => { loadSchedule(); }, [loadSchedule]);

    useEffect(() => {
        if (!selectedDate.startsWith(month)) {
            const next = `${month}-01`;
            setSelectedDate(next);
            setForm(emptyForm(next));
            setEditingId(null);
        }
    }, [month, selectedDate]);

    const filteredEvents = useMemo(
        () => filter === 'all' ? events : events.filter((event) => event.ownerId === filter),
        [events, filter]
    );

    const eventsByDate = useMemo(() => {
        const map = {};
        filteredEvents.forEach((event) => {
            if (!map[event.date]) map[event.date] = [];
            map[event.date].push(event);
        });
        return map;
    }, [filteredEvents]);

    const selectedEvents = useMemo(
        () => events.filter((event) => event.date === selectedDate),
        [events, selectedDate]
    );

    const stats = useMemo(() => ({
        terence: events.filter((e) => e.ownerId === 'terence' && e.status === 'busy').length,
        partner: events.filter((e) => e.ownerId === 'partner' && e.status === 'busy').length,
        together: new Set(events.filter((e) => e.status === 'busy').map((e) => e.date)).size
    }), [events]);

    const chooseDate = (date) => {
        setSelectedDate(date);
        setEditingId(null);
        setForm(emptyForm(date));
    };

    const saveEvent = async (e) => {
        e.preventDefault();
        if (!identity || saving) return;
        setSaving(true);
        try {
            const res = await fetch(editingId ? `${FEATURE_API_URL}/schedule/${editingId}` : `${FEATURE_API_URL}/schedule`, {
                method: editingId ? 'PATCH' : 'POST',
                headers: personHeaders(identity, true),
                body: JSON.stringify(form)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not save schedule item');
            await loadSchedule();
            setEditingId(null);
            setForm(emptyForm(selectedDate));
            setError('');
        } catch (err) {
            setError(err.message || 'Could not save schedule item');
        } finally {
            setSaving(false);
        }
    };

    const editEvent = (event) => {
        if (event.ownerId !== identity) return;
        setSelectedDate(event.date);
        setEditingId(event.id);
        setForm({
            title: event.title,
            date: event.date,
            allDay: Boolean(event.allDay),
            startTime: event.startTime || '09:00',
            endTime: event.endTime || '10:00',
            status: event.status || 'busy',
            notes: event.notes || ''
        });
    };

    const deleteEvent = async (event) => {
        if (event.ownerId !== identity || !window.confirm(`Delete "${event.title}"?`)) return;
        try {
            const res = await fetch(`${FEATURE_API_URL}/schedule/${event.id}`, {
                method: 'DELETE',
                headers: personHeaders(identity)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not delete schedule item');
            setEvents((current) => current.filter((item) => item.id !== event.id));
            if (editingId === event.id) {
                setEditingId(null);
                setForm(emptyForm(selectedDate));
            }
        } catch (err) {
            setError(err.message || 'Could not delete schedule item');
        }
    };

    const goToday = () => {
        const today = new Date();
        setMonth(monthKey(today));
        chooseDate(dateKey(today));
    };

    const ownerStyles = (ownerId) => ownerId === 'terence'
        ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200'
        : 'border-pink-500/40 bg-pink-500/10 text-pink-200';

    return (
        <AuthWrapper>
            <Head><title>Schedule | SliderApp</title></Head>
            <Navbar />
            <PersonPicker value={identity} onChange={setIdentity} />

            <main className="min-h-screen bg-dark-bg pt-24 pb-14 px-3 md:px-4">
                <div className="max-w-[1450px] mx-auto">
                    <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 mb-6">
                        <div>
                            <div className="text-primary-light text-sm font-medium mb-2">Shared availability</div>
                            <h1 className="text-3xl md:text-4xl font-bold">Our Schedule</h1>
                            <p className="text-slate-400 mt-2">See when each of you is busy or available before making plans.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <PersonPicker value={identity} onChange={setIdentity} />
                            <button onClick={goToday} className="px-4 py-2.5 rounded-xl border border-dark-border bg-dark-card text-sm hover:bg-white/5">Today</button>
                        </div>
                    </div>

                    {error && <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">{error}</div>}

                    <section className="grid sm:grid-cols-3 gap-3 mb-5">
                        <div className="card-dark p-4">
                            <div className="flex items-center gap-2 text-sm text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />Terence busy</div>
                            <div className="text-2xl font-bold mt-2">{stats.terence}</div>
                            <div className="text-xs text-slate-600 mt-1">entries this month</div>
                        </div>
                        <div className="card-dark p-4">
                            <div className="flex items-center gap-2 text-sm text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-pink-400" />Partner busy</div>
                            <div className="text-2xl font-bold mt-2">{stats.partner}</div>
                            <div className="text-xs text-slate-600 mt-1">entries this month</div>
                        </div>
                        <div className="card-dark p-4">
                            <div className="text-sm text-slate-400">Days with plans</div>
                            <div className="text-2xl font-bold mt-2">{stats.together}</div>
                            <div className="text-xs text-slate-600 mt-1">days have busy time recorded</div>
                        </div>
                    </section>

                    <div className="grid xl:grid-cols-[minmax(0,1fr)_390px] gap-5 items-start">
                        <section className="card-dark overflow-hidden">
                            <header className="p-4 md:p-5 border-b border-dark-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setMonth(shiftMonth(month, -1))} className="w-9 h-9 rounded-lg border border-dark-border hover:bg-white/5">←</button>
                                    <h2 className="font-semibold text-lg md:text-xl min-w-44 text-center">{monthTitle(month)}</h2>
                                    <button onClick={() => setMonth(shiftMonth(month, 1))} className="w-9 h-9 rounded-lg border border-dark-border hover:bg-white/5">→</button>
                                </div>
                                <div className="flex items-center gap-1 p-1 bg-dark-bg border border-dark-border rounded-xl">
                                    {[['all','Both'],['terence','Terence'],['partner','Partner']].map(([id,label]) => (
                                        <button key={id} onClick={() => setFilter(id)} className={`px-3 py-2 rounded-lg text-xs font-medium ${filter === id ? 'bg-primary text-white' : 'text-slate-500 hover:text-white'}`}>{label}</button>
                                    ))}
                                </div>
                            </header>

                            <div className="grid grid-cols-7 border-b border-dark-border bg-dark-bg/40">
                                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => (
                                    <div key={day} className="py-2.5 text-center text-[10px] sm:text-xs uppercase tracking-wider text-slate-500">{day}</div>
                                ))}
                            </div>

                            {loading ? (
                                <div className="min-h-[520px] grid place-items-center text-slate-500">Loading schedule…</div>
                            ) : (
                                <div className="grid grid-cols-7">
                                    {Array.from({ length: firstWeekday }).map((_, i) => <div key={`blank-${i}`} className="min-h-24 sm:min-h-28 md:min-h-32 border-r border-b border-dark-border/70 bg-dark-bg/20" />)}
                                    {Array.from({ length: daysInMonth }).map((_, index) => {
                                        const day = index + 1;
                                        const key = `${month}-${pad(day)}`;
                                        const dayEvents = eventsByDate[key] || [];
                                        const isSelected = selectedDate === key;
                                        const isToday = key === dateKey();
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => chooseDate(key)}
                                                className={`min-h-24 sm:min-h-28 md:min-h-32 p-1.5 sm:p-2 border-r border-b border-dark-border/70 text-left align-top transition-colors overflow-hidden ${isSelected ? 'bg-primary/8 ring-1 ring-inset ring-primary/50' : 'hover:bg-white/[0.025]'}`}
                                            >
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className={`w-7 h-7 rounded-full grid place-items-center text-xs sm:text-sm ${isToday ? 'bg-primary text-white font-bold' : 'text-slate-400'}`}>{day}</span>
                                                    {dayEvents.length > 0 && <span className="text-[9px] text-slate-600">{dayEvents.length}</span>}
                                                </div>
                                                <div className="space-y-1">
                                                    {dayEvents.slice(0, 3).map((event) => (
                                                        <div key={event.id} className={`rounded-md border px-1.5 py-1 text-[9px] sm:text-[10px] leading-tight truncate ${ownerStyles(event.ownerId)}`}>
                                                            <span className={event.status === 'available' ? 'text-emerald-300' : ''}>{event.allDay ? '• ' : `${event.startTime} `}</span>{event.title}
                                                        </div>
                                                    ))}
                                                    {dayEvents.length > 3 && <div className="text-[9px] text-slate-600 px-1">+{dayEvents.length - 3} more</div>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <footer className="px-4 py-3 border-t border-dark-border flex flex-wrap gap-4 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" />Terence</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-pink-400" />Partner</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Available entry</span>
                            </footer>
                        </section>

                        <aside className="space-y-5 xl:sticky xl:top-24">
                            <section className="card-dark overflow-hidden">
                                <div className="p-5 border-b border-dark-border">
                                    <div className="text-xs text-primary-light font-medium mb-1">Selected day</div>
                                    <h2 className="font-semibold text-lg">{longDate(selectedDate)}</h2>
                                </div>
                                <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
                                    {selectedEvents.length === 0 ? (
                                        <div className="text-sm text-slate-500 py-6 text-center">Nobody has added anything for this day.</div>
                                    ) : selectedEvents.map((event) => {
                                        const mine = event.ownerId === identity;
                                        return (
                                            <div key={event.id} className={`rounded-xl border p-3 ${ownerStyles(event.ownerId)}`}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[10px] uppercase tracking-wide opacity-70">{event.ownerName || PEOPLE[event.ownerId]?.name}</span>
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${event.status === 'available' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{event.status === 'available' ? 'Available' : 'Busy'}</span>
                                                        </div>
                                                        <div className="font-semibold mt-1 break-words">{event.title}</div>
                                                        <div className="text-xs opacity-70 mt-1">{eventTime(event)}</div>
                                                        {event.notes && <div className="text-xs opacity-70 mt-2 whitespace-pre-wrap">{event.notes}</div>}
                                                    </div>
                                                    {mine && (
                                                        <div className="flex gap-1 shrink-0">
                                                            <button onClick={() => editEvent(event)} className="p-1.5 rounded-md hover:bg-white/10" title="Edit">✎</button>
                                                            <button onClick={() => deleteEvent(event)} className="p-1.5 rounded-md hover:bg-red-500/10 hover:text-red-300" title="Delete">×</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <form onSubmit={saveEvent} className="card-dark p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="font-semibold">{editingId ? 'Edit your schedule' : 'Add to your schedule'}</h2>
                                        <p className="text-xs text-slate-500 mt-1">Saving as {PEOPLE[identity]?.name || 'your profile'}</p>
                                    </div>
                                    {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm(selectedDate)); }} className="text-xs text-slate-500 hover:text-white">Cancel</button>}
                                </div>

                                <label className="block mb-3">
                                    <span className="block text-xs text-slate-400 mb-1.5">What are you doing?</span>
                                    <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 100) })} placeholder="Class, work, appointment…" className="input-dark" />
                                </label>

                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <label>
                                        <span className="block text-xs text-slate-400 mb-1.5">Date</span>
                                        <input type="date" required value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); setSelectedDate(e.target.value); }} className="input-dark !px-3 [color-scheme:dark]" />
                                    </label>
                                    <label>
                                        <span className="block text-xs text-slate-400 mb-1.5">Status</span>
                                        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-dark !px-3 [color-scheme:dark]">
                                            <option value="busy">Busy / Not free</option>
                                            <option value="available">Available</option>
                                        </select>
                                    </label>
                                </div>

                                <label className="flex items-center gap-2 mb-3 text-sm text-slate-300 cursor-pointer">
                                    <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="accent-indigo-500" />
                                    All day
                                </label>

                                {!form.allDay && (
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <label><span className="block text-xs text-slate-400 mb-1.5">From</span><input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="input-dark !px-3 [color-scheme:dark]" /></label>
                                        <label><span className="block text-xs text-slate-400 mb-1.5">Until</span><input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="input-dark !px-3 [color-scheme:dark]" /></label>
                                    </div>
                                )}

                                <label className="block mb-4">
                                    <span className="block text-xs text-slate-400 mb-1.5">Notes</span>
                                    <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 500) })} placeholder="Optional details…" className="input-dark resize-none" />
                                </label>

                                <button disabled={!identity || saving} className="btn-gradient w-full disabled:opacity-40">
                                    {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add schedule'}
                                </button>
                            </form>
                        </aside>
                    </div>
                </div>
            </main>
        </AuthWrapper>
    );
}
