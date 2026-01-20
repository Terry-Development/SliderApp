import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function Navbar() {
    const router = useRouter();
    const isSlider = router.pathname === '/';
    const isGallery = router.pathname === '/gallery';
    const [isOpen, setIsOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('admin_password');
        window.location.reload();
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/95 backdrop-blur-lg border-b border-dark-border">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between relative">

                {/* Mobile Menu Button - Left */}
                <button
                    className="md:hidden z-50 p-2 -ml-2 text-gray-300 hover:text-white"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    )}
                </button>

                {/* Logo/Title */}
                {/* Mobile: Absolute Center */}
                {/* Desktop: Static Left */}
                <Link
                    href="/"
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:static md:translate-x-0 md:translate-y-0 md:flex md:items-center md:gap-2 z-50 flex items-center gap-2"
                >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <span className="font-bold text-lg whitespace-nowrap">SliderApp</span>
                </Link>

                {/* Desktop Nav - Right */}
                <div className="hidden md:flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <Link href="/" className={isSlider ? 'nav-link-active' : 'nav-link'}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Slider
                        </Link>

                        <Link href="/gallery" className={isGallery ? 'nav-link-active' : 'nav-link'}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            Gallery
                        </Link>

                        <Link href="/reminders" className={router.pathname === '/reminders' ? 'nav-link-active' : 'nav-link'}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            Reminders
                        </Link>
                    </div>

                    <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                        <button
                            onClick={handleLogout}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                            title="Logout"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mobile Sidebar & Backdrop */}
                {isOpen && (
                    <div
                        className="fixed inset-0 h-[100dvh] bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
                        onClick={() => setIsOpen(false)}
                    />
                )}

                {/* Sidebar: Solid Background (zinc-900), Full Dynamic Height */}
                <div className={`fixed top-0 left-0 h-[100dvh] w-64 bg-zinc-900 border-r border-white/10 z-[60] transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-6 flex flex-col h-full">
                        <div className="flex justify-between items-center mb-8">
                            <span className="font-bold text-xl">Menu</span>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 text-gray-400 hover:text-white"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex flex-col gap-6">
                            <Link
                                href="/"
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 text-lg font-medium ${isSlider ? 'text-primary' : 'text-gray-300'}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Slider
                            </Link>

                            <Link
                                href="/gallery"
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 text-lg font-medium ${isGallery ? 'text-primary' : 'text-gray-300'}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                                Gallery
                            </Link>

                            <Link
                                href="/reminders"
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 text-lg font-medium ${router.pathname === '/reminders' ? 'text-primary' : 'text-gray-300'}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                Reminders
                            </Link>

                            <div className="h-px bg-white/10 my-2" />

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 text-lg font-medium text-slate-400 hover:text-white mt-auto mb-4"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
