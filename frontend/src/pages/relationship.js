import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Navbar from '../components/Navbar';
import HeartCounter from '../components/relationship/HeartCounter';
import CountdownCard from '../components/relationship/CountdownCard';
import { getDaysTogether, getNextEventDate, getDaysRemaining, formatDate } from '../utils/dateUtils';
import Swal from 'sweetalert2';

// API Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// In a real app we'd get this from a secure auth context, but reusing the pattern seen in server.js headers
// In a real app we'd get this from a secure auth context, but reusing the pattern seen in server.js headers
const getAdminPassword = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('admin_password') || 'secret';
    }
    return 'secret';
};

export default function RelationshipDashboard() {
    const [anniversaryDate, setAnniversaryDate] = useState('');
    const [daysTogether, setDaysTogether] = useState(0);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [customEvents, setCustomEvents] = useState([]); // Events from DB

    // Load data on mount
    useEffect(() => {
        fetchData();
    }, []);


    const fetchData = async () => {
        const url = `${API_URL}/relationship/data`;
        console.log('Fetching data from:', url);
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();

            if (data.anniversaryDate) {
                setAnniversaryDate(data.anniversaryDate);
                setDaysTogether(getDaysTogether(data.anniversaryDate));
            }

            if (data.events) {
                setCustomEvents(data.events);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
    };

    // Recalculate everything when "base" data changes
    useEffect(() => {
        generateAllEvents();
    }, [anniversaryDate, customEvents]); // Potential loop if generateAllEvents sets customEvents?
    // Wait, generateAllEvents calls setUpcomingEvents, NOT setCustomEvents.
    // However, if customEvents changes (fetched from DB), we re-run this. Correct.

    // BUT! fetchData sets customEvents. If fetchData is called, it triggers this.
    // That seems fine.

    // The issue might be handleDateChange triggers a fetch(POST) but doesnt wait for it to complete before updating state?
    // Wait, handleDateChange updates state locally immediately: setAnniversaryDate(date).
    // Then it saves.
    // If the user refreshes, fetchData grabs from DB.

    // START DEBUGGING: The user said "data is not saving when i refresh".
    // This means the POST request likely failed or didn't complete.
    // I need to make sure the POST headers are correct.
    // server.js expects 'Content-Type': 'application/json' AND 'x-admin-password'.
    // `handleDateChange` sends both.

    // Let's add more logging to the save function.

    const handleDateChange = async (date) => {
        // Optimistic update
        setAnniversaryDate(date);
        setDaysTogether(getDaysTogether(date));

        // Persist
        try {
            console.log('Saving anniversary:', date);
            const res = await fetch(`${API_URL}/relationship/anniversary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-password': getAdminPassword()
                },
                body: JSON.stringify({ date })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Failed to save: ${res.status} ${errText}`);
            }
            console.log('Anniversary saved successfully');
        } catch (error) {
            console.error('Failed to save anniversary:', error);
            Swal.fire('Error', 'Failed to save date. Check console.', 'error');
        }
    };

    const generateAllEvents = () => {
        // 1. Fixed Holidays
        let events = [
            { name: "Valentine's Day", date: getNextEventDate(1, 14), type: 'holiday' },
            { name: "Christmas", date: getNextEventDate(11, 25), type: 'holiday' },
            { name: "New Year's Day", date: getNextEventDate(0, 1), type: 'holiday' },
        ];

        // 2. Anniversary (if set)
        if (anniversaryDate) {
            const [y, m, d] = anniversaryDate.split('-').map(Number);
            events.push({
                name: "Our Anniversary",
                date: getNextEventDate(m - 1, d),
                type: 'anniversary'
            });
        }

        // 3. Custom Events (from DB)
        customEvents.forEach(evt => {
            if (evt.date) {
                const [y, m, d] = evt.date.split('-').map(Number);
                events.push({
                    id: evt.id, // Keep ID for potential deletion
                    name: evt.name,
                    date: getNextEventDate(m - 1, d),
                    type: 'custom'
                });
            }
        });

        // Process & Sort
        const processedEvents = events.map(ev => ({
            ...ev,
            daysRemaining: getDaysRemaining(ev.date),
            formattedDate: formatDate(ev.date)
        }));

        processedEvents.sort((a, b) => a.daysRemaining - b.daysRemaining);

        setUpcomingEvents(processedEvents);
    };

    const addNewEvent = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Add New Event',
            html:
                '<input id="swal-input1" class="swal2-input" placeholder="Event Name">' +
                '<input id="swal-input2" class="swal2-input" type="date">',
            focusConfirm: false,
            preConfirm: () => {
                return [
                    document.getElementById('swal-input1').value,
                    document.getElementById('swal-input2').value
                ]
            },
            confirmButtonColor: '#ec4899' // Pink-500
        });

        if (formValues) {
            const [name, date] = formValues;
            if (!name || !date) return;

            const newEvent = { id: Date.now().toString(), name, date };

            // Optimistic update
            const updatedEvents = [...customEvents, newEvent];
            setCustomEvents(updatedEvents);

            // Save to DB
            try {
                await fetch(`${API_URL}/relationship/events`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-password': getAdminPassword()
                    },
                    body: JSON.stringify({ event: newEvent })
                });
            } catch (error) {
                console.error('Failed to save event:', error);
                // Revert on fail? (Simplified: Just rely on next fetch or error log)
            }
        }
    };

    const deleteEvent = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Event?',
            text: `Remove "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            // Optimistic
            setCustomEvents(customEvents.filter(e => e.id !== id));

            try {
                await fetch(`${API_URL}/relationship/events/${id}`, {
                    method: 'DELETE',
                    headers: { 'x-admin-password': getAdminPassword() }
                });
            } catch (error) {
                console.error('Failed to delete:', error);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 pb-20">
            <Head>
                <title>Relationship Dashboard</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <Navbar />

            <main className="max-w-4xl mx-auto px-4 pt-24 pb-12 space-y-8 md:space-y-12">

                {/* Hero Section */}
                <section className="animate-fade-in-up">
                    <HeartCounter
                        daysTogether={daysTogether}
                        anniversaryDate={anniversaryDate}
                        onDateChange={handleDateChange}
                    />
                </section>

                {/* Grid Section */}
                <section>
                    <div className="flex items-center justify-between mb-6 px-2">
                        <h2 className="text-2xl font-bold text-white tracking-tight">Upcoming Moments</h2>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={addNewEvent}
                                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-all border border-white/20"
                                title="Add Event"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                            <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                                {upcomingEvents.length} Events
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {upcomingEvents.map((ev, index) => (
                            <div key={index} className="relative group animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                                <CountdownCard
                                    eventName={ev.name}
                                    eventDate={ev.formattedDate}
                                    daysRemaining={ev.daysRemaining}
                                />
                                {/* Delete Button for Custom Events */}
                                {ev.type === 'custom' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id, ev.name); }}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <div className="h-10"></div>
            </main>

            <style jsx global>{`
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fadeInUp 0.6s ease-out forwards;
        }
        /* SweetAlert Customization */
        div:where(.swal2-container) div:where(.swal2-popup) {
            background: #1e293b !important;
            border: 1px solid #334155;
            color: #f8fafc;
        }
        .swal2-input {
            background: #0f172a !important;
            border: 1px solid #475569 !important;
            color: white !important;
        }
      `}</style>
        </div>
    );
}
