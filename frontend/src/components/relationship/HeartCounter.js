import React from 'react';

const HeartCounter = ({ daysTogether, anniversaryDate, onDateChange }) => {
    return (
        <div className="relative w-full text-center py-8 px-4 rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-500/80 via-purple-500/80 to-pink-500/80 backdrop-blur-3xl shadow-2xl border border-white/20 min-h-[50vh] flex flex-col items-center justify-center transition-all duration-500">

            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-400 rounded-full blur-[100px] opacity-40"></div>
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-400 rounded-full blur-[80px] opacity-30"></div>
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center space-y-6">
                {/* Heart Icon with Pulse Animation */}
                <div className="relative">
                    <div className="absolute inset-0 bg-red-500 blur-xl opacity-50 animate-pulse"></div>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-20 h-20 text-red-50 to-pink-100 drop-shadow-lg text-pink-100 animate-pulse"
                        style={{ animationDuration: '3s' }}
                    >
                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                </div>

                {/* Counter Text */}
                <div className="space-y-2">
                    <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter drop-shadow-md">
                        {daysTogether}
                    </h1>
                    <p className="text-pink-100 text-lg md:text-xl font-medium tracking-wide uppercase opacity-90">Days of Love</p>
                </div>

                {/* Anniversary Input */}
                <div className="mt-8 pt-6 border-t border-white/20 w-full max-w-sm mx-auto">
                    <label className="block text-xs uppercase text-pink-100/70 font-semibold mb-2 tracking-wider">
                        Our Anniversary Date
                    </label>
                    <input
                        type="date"
                        value={anniversaryDate}
                        onChange={(e) => onDateChange(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white/20 transition-all text-center font-semibold [color-scheme:dark]"
                    />
                </div>
            </div>
        </div>
    );
};

export default HeartCounter;
