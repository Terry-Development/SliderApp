import React from 'react';

const CountdownCard = ({ eventName, eventDate, daysRemaining }) => {
    return (
        <div className="relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl bg-white/10 backdrop-blur-md border border-white/20 text-white group">
            {/* Decorative gradient blob */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-pink-500/20 rounded-full blur-2xl group-hover:bg-pink-500/30 transition-colors"></div>

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <h3 className="text-xl font-bold tracking-tight mb-1 text-white/90">{eventName}</h3>
                    <p className="text-sm text-pink-200 font-medium">{eventDate}</p>
                </div>

                <div className="mt-4 flex items-end justify-between">
                    <div className="flex flex-col">
                        <span className="text-4xl font-black bg-gradient-to-br from-pink-300 to-white bg-clip-text text-transparent">
                            {daysRemaining}
                        </span>
                        <span className="text-xs uppercase tracking-widest text-pink-200/70 font-semibold">Days Left</span>
                    </div>

                    {/* Subtle icon/indicator */}
                    <div className="bg-white/10 p-2 rounded-full">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-pink-300"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CountdownCard;
