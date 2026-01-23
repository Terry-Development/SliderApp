import React, { useState, useMemo } from 'react';

export default function CalendarView({ images, onDateClick }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        // 0 = Sunday, 1 = Monday, ...
        // We want Monday start? Instagram usually starts Sunday or based on locale.
        // Let's adjust to Monday start (0=Mon, 6=Sun) if preferred, or stick to standard (0=Sun).
        // Let's stick to Standard (Sun=0) for compatibility but render Mon-Sun visuals if we want.
        // Let's do Mon-Sun as shown in user screenshot (Mon Tue Wed...)
        let day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        return day === 0 ? 6 : day - 1; // Shift so Mon=0, Sun=6
    };

    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);

    // Group images by date (YYYY-MM-DD)
    const imagesByDate = useMemo(() => {
        const groups = {};
        images.forEach(img => {
            // img.createdAt is ISO string
            try {
                const dateStr = img.createdAt.split('T')[0];
                if (!groups[dateStr]) groups[dateStr] = [];
                groups[dateStr].push(img);
            } catch (e) {
                console.error("Invalid date", img);
            }
        });
        return groups;
    }, [images]);

    const changeMonth = (offset) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const generateCalendarGrid = () => {
        const grid = [];
        // Empty cells for padding
        for (let i = 0; i < firstDay; i++) {
            grid.push(<div key={`empty-${i}`} className="aspect-square"></div>);
        }

        // Days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayImages = imagesByDate[dateStr] || [];
            const coverImage = dayImages.length > 0 ? dayImages[0].url : null; // Use first found (or newest if sorted)

            grid.push(
                <div
                    key={day}
                    onClick={() => dayImages.length > 0 && onDateClick(dayImages)}
                    className={`aspect-square relative flex items-center justify-center rounded-full m-1 cursor-pointer transition-all ${dayImages.length > 0 ? 'hover:scale-110' : ''}`}
                >
                    <span className={`z-10 text-sm font-medium ${coverImage ? 'text-white drop-shadow-md' : 'text-slate-400'}`}>
                        {day}
                    </span>

                    {coverImage && (
                        <div className="absolute inset-0 rounded-full overflow-hidden border-2 border-transparent hover:border-white/50">
                            <img src={coverImage} alt="" className="w-full h-full object-cover opacity-80 hover:opacity-100" />
                            <div className="absolute inset-0 bg-black/20"></div>
                        </div>
                    )}
                </div>
            );
        }
        return grid;
    };

    return (
        <div className="w-full max-w-md mx-auto p-4 bg-black/50 rounded-2xl backdrop-blur-sm animate-in fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 px-2">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-xl font-bold text-white">
                    {monthNames[currentDate.getMonth()]} <span className="text-slate-400">{currentDate.getFullYear()}</span>
                </h2>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{d}</div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1">
                {generateCalendarGrid()}
            </div>
        </div>
    );
}
