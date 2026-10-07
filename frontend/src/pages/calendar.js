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
    return new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric'
    }).format(parseMonth(value));
}

function formatDayHeading(value) {
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    }).format(new Date(`${value}T00:00:00`));
}

function dayNumber(value) {
    return new Date(`${value}T00:00:00`).getDate();
}

function weekdayShort(value) {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' })
        .format(new Date(`${value}T00:00:00`));
}

function eventTime(event) {
    if (event.allDay) return 'All day';
    return `${event.startTime} – ${event.endTime}`;
}

const emptyForm = (date = dateKey()) => ({
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
    const [events, setEvents] = useState([]);
    const [filter, setFilter] = useState('all');
    const [form, setForm] = useState(emptyForm());
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => setIdentity(getStoredIdentity()), []);

    const monthStart = `${month}-01`;
    const monthDate = parseMonth(month);
    const monthEnd = dateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));

    const loadSchedule = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `${FEATURE_API_URL}/schedule?start=${monthStart}&end=${monthEnd}`,
                {
                    headers: personHeaders(identity),
                    cache: 'no-store'
                }
            );
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

    useEffect(() => {
        loadSchedule();
    }, [loadSchedule]);

    const filteredEvents = useMemo(() => {
        if (filter === 'all') return events;
        return events.filter((event) => event.ownerId === filter);
    }, [events, filter]);

    const groupedEvents = useMemo(() => {
        const groups = [];
        filteredEvents.forEach((event) => {
            let group = groups.find((item) => item.date === event.date);
            if (!group) {
                group = { date: event.date, events: [] };
                groups.push(group);
            }
            group.events.push(event);
        });
        return groups;
    }, [filteredEvents]);

    const openNewForm = () => {
        const defaultDate = month === monthKey() ? dateKey() : `${month}-01`;
        setEditingId(null);
        setForm(emptyForm(defaultDate));
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const editEvent = (event) => {
        if (event.ownerId !== identity) return;
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
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closeForm = () => {
        setEditingId(null);
        setShowForm(false);
        setForm(emptyForm(month === monthKey() ? dateKey() : `${month}-01`));
    };

    const saveEvent = async (e) => {
        e.preventDefault();
        if (!identity || saving) return;

        setSaving(true);
        try {
            const res = await fetch(
                editingId
                    ? `${FEATURE_API_URL}/schedule/${editingId}`
                    : `${FEATURE_API_URL}/schedule`,
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: personHeaders(identity, true),
                    body: JSON.stringify(form)
                }
            );

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not save schedule item');

            const targetMonth = form.date.slice(0, 7);
            closeForm();

            if (targetMonth !== month) {
                setMonth(targetMonth);
            } else {
                await loadSchedule();
            }

            setError('');
        } catch (err) {
            setError(err.message || 'Could not save schedule item');
        } finally {
            setSaving(false);
        }
    };

    const deleteEvent = async (event) => {
        if (event.ownerId !== identity) return;
        if (!window.confirm(`Delete "${event.title}"?`)) return;

        try {
            const res = await fetch(`${FEATURE_API_URL}/schedule/${event.id}`, {
                method: 'DELETE',
                headers: personHeaders(identity)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not delete schedule item');

            setEvents((current) => current.filter((item) => item.id !== event.id));
        } catch (err) {
            setError(err.message || 'Could not delete schedule item');
        }
    };

    const personCardStyle = (ownerId) =>
        ownerId === 'terence'
            ? 'border-indigo-500/35 bg-indigo-500/[0.07]'
            : 'border-pink-500/35 bg-pink-500/[0.07]';

    const personPillStyle = (ownerId) =>
        ownerId === 'terence'
            ? 'bg-indigo-500/15 text-indigo-300'
            : 'bg-pink-500/15 text-pink-300';

    return (
        <AuthWrapper>
            <Head><title>Schedule | SliderApp</title></Head>
            <Navbar />
            <PersonPicker value={identity} onChange={setIdentity} />

            <main className="min-h-screen bg-dark-bg pt-24 pb-14 px-3 md:px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-6">
                        <div>
                            <div className="text-primary-light text-sm font-medium mb-2">Shared availability</div>
                            <h1 className="text-3xl md:text-4xl font-bold">Monthly Schedule</h1>
                            <p className="text-slate-400 mt-2">
                                A simple month-by-month view of what Terence and Jessy have planned.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <PersonPicker value={identity} onChange={setIdentity} />
                            <button
                                onClick={openNewForm}
                                className="btn-gradient px-4 py-2.5 whitespace-nowrap"
                            >
                                + Add schedule
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}

                    <section className="card-dark p-4 md:p-5 mb-5">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center justify-between md:justify-start gap-2">
                                <button
                                    onClick={() => setMonth(shiftMonth(month, -1))}
                                    className="w-10 h-10 rounded-xl border border-dark-border bg-dark-bg hover:bg-white/5 text-lg"
                                    aria-label="Previous month"
                                >
                                    ←
                                </button>

                                <div className="min-w-48 text-center">
                                    <div className="text-xl md:text-2xl font-bold">{monthTitle(month)}</div>
                                    <button
                                        onClick={() => setMonth(monthKey())}
                                        className="text-xs text-primary-light hover:text-white mt-1"
                                    >
                                        Jump to current month
                                    </button>
                                </div>

                                <button
                                    onClick={() => setMonth(shiftMonth(month, 1))}
                                    className="w-10 h-10 rounded-xl border border-dark-border bg-dark-bg hover:bg-white/5 text-lg"
                                    aria-label="Next month"
                                >
                                    →
                                </button>
                            </div>

                            <div className="flex items-center gap-1 p-1 bg-dark-bg border border-dark-border rounded-xl overflow-x-auto">
                                {[
                                    ['all', 'Both'],
                                    ['terence', 'Terence'],
                                    ['partner', 'Jessy']
                                ].map(([id, label]) => (
                                    <button
                                        key={id}
                                        onClick={() => setFilter(id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                            filter === id
                                                ? 'bg-primary text-white'
                                                : 'text-slate-500 hover:text-white'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {showForm && (
                        <form onSubmit={saveEvent} className="card-dark p-5 md:p-6 mb-5">
                            <div className="flex items-start justify-between gap-4 mb-5">
                                <div>
                                    <h2 className="text-lg font-semibold">
                                        {editingId ? 'Edit schedule' : 'Add schedule'}
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Saving as {PEOPLE[identity]?.name || 'your profile'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="text-slate-500 hover:text-white p-2"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <label className="md:col-span-2">
                                    <span className="block text-sm text-slate-400 mb-1.5">Event</span>
                                    <input
                                        required
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value.slice(0, 100) })}
                                        placeholder="Class, work, appointment, dinner..."
                                        className="input-dark"
                                    />
                                </label>

                                <label>
                                    <span className="block text-sm text-slate-400 mb-1.5">Date</span>
                                    <input
                                        type="date"
                                        required
                                        value={form.date}
                                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                                        className="input-dark !px-3 [color-scheme:dark]"
                                    />
                                </label>

                                <label>
                                    <span className="block text-sm text-slate-400 mb-1.5">Availability</span>
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        className="input-dark !px-3 [color-scheme:dark]"
                                    >
                                        <option value="busy">Busy / Not free</option>
                                        <option value="available">Available</option>
                                    </select>
                                </label>
                            </div>

                            <label className="flex items-center gap-2 my-4 text-sm text-slate-300 cursor-pointer w-fit">
                                <input
                                    type="checkbox"
                                    checked={form.allDay}
                                    onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
                                    className="accent-indigo-500"
                                />
                                All day
                            </label>

                            {!form.allDay && (
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <label>
                                        <span className="block text-sm text-slate-400 mb-1.5">From</span>
                                        <input
                                            type="time"
                                            required
                                            value={form.startTime}
                                            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                                            className="input-dark !px-3 [color-scheme:dark]"
                                        />
                                    </label>
                                    <label>
                                        <span className="block text-sm text-slate-400 mb-1.5">Until</span>
                                        <input
                                            type="time"
                                            required
                                            value={form.endTime}
                                            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                                            className="input-dark !px-3 [color-scheme:dark]"
                                        />
                                    </label>
                                </div>
                            )}

                            <label className="block mb-5">
                                <span className="block text-sm text-slate-400 mb-1.5">Notes</span>
                                <textarea
                                    rows={3}
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 500) })}
                                    placeholder="Optional details..."
                                    className="input-dark resize-none"
                                />
                            </label>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeForm}
                                    className="px-4 py-2.5 rounded-xl border border-dark-border text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={!identity || saving}
                                    className="btn-gradient px-5 py-2.5 disabled:opacity-40"
                                >
                                    {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add event'}
                                </button>
                            </div>
                        </form>
                    )}

                    <section>
                        {loading ? (
                            <div className="card-dark py-20 text-center text-slate-500">
                                Loading schedule...
                            </div>
                        ) : groupedEvents.length === 0 ? (
                            <div className="card-dark py-16 px-6 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-dark-bg border border-dark-border grid place-items-center mx-auto mb-4 text-slate-500">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h2 className="font-semibold text-lg">Nothing scheduled in {monthTitle(month)}</h2>
                                <p className="text-slate-500 text-sm mt-2">
                                    Add an event when either of you is busy or free.
                                </p>
                                <button onClick={openNewForm} className="btn-gradient px-4 py-2.5 mt-5">
                                    + Add first event
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-7">
                                {groupedEvents.map((group) => (
                                    <div key={group.date}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-14 h-14 rounded-2xl bg-dark-card border border-dark-border flex flex-col items-center justify-center shrink-0">
                                                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                                                    {weekdayShort(group.date)}
                                                </span>
                                                <span className="text-xl font-bold leading-none mt-1">
                                                    {dayNumber(group.date)}
                                                </span>
                                            </div>
                                            <div>
                                                <h2 className="font-semibold text-lg">{formatDayHeading(group.date)}</h2>
                                                <p className="text-xs text-slate-500">
                                                    {group.events.length} {group.events.length === 1 ? 'event' : 'events'}
                                                </p>
                                            </div>
                                            <div className="h-px bg-dark-border flex-1 ml-2" />
                                        </div>

                                        <div className="space-y-3 md:pl-[68px]">
                                            {group.events.map((event) => {
                                                const mine = event.ownerId === identity;
                                                const ownerName = PEOPLE[event.ownerId]?.name || event.ownerName || 'Unknown';

                                                return (
                                                    <article
                                                        key={event.id}
                                                        className={`rounded-2xl border p-4 md:p-5 ${personCardStyle(event.ownerId)}`}
                                                    >
                                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${personPillStyle(event.ownerId)}`}>
                                                                        {ownerName}
                                                                    </span>
                                                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                                                        event.status === 'available'
                                                                            ? 'bg-emerald-500/15 text-emerald-300'
                                                                            : 'bg-rose-500/15 text-rose-300'
                                                                    }`}>
                                                                        {event.status === 'available' ? 'Available' : 'Busy'}
                                                                    </span>
                                                                    <span className="text-xs text-slate-500">{eventTime(event)}</span>
                                                                </div>

                                                                <h3 className="text-lg md:text-xl font-semibold break-words">
                                                                    {event.title}
                                                                </h3>

                                                                {event.notes && (
                                                                    <p className="text-sm text-slate-400 mt-2 whitespace-pre-wrap">
                                                                        {event.notes}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {mine && (
                                                                <div className="flex gap-2 shrink-0">
                                                                    <button
                                                                        onClick={() => editEvent(event)}
                                                                        className="px-3 py-2 rounded-lg border border-dark-border bg-dark-bg/40 text-xs text-slate-300 hover:text-white"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteEvent(event)}
                                                                        className="px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-300 hover:bg-red-500/10"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </AuthWrapper>
    );
}
