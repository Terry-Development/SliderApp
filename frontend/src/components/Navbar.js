import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

const navItems = [
    { href: '/', label: 'Slider', icon: 'photo' },
    { href: '/gallery', label: 'Gallery', icon: 'grid' },
    { href: '/calendar', label: 'Schedule', icon: 'calendar' },
    { href: '/reminders', label: 'Reminders', icon: 'bell' },
    { href: '/relationship', label: 'Relationship', icon: 'heart' },
    { href: '/notes', label: 'Notes', icon: 'note' },
    { href: '/watermark', label: 'Watermark', icon: 'sparkles' },
    { href: '/chat', label: 'Chat', icon: 'chat' },
    { href: '/expenses', label: 'Expenses', icon: 'wallet' },
];

function NavIcon({ icon, className = 'w-5 h-5' }) {
    const common = { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' };
    const paths = {
        photo: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
        grid: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />,
        calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
        bell: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
        heart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
        note: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5h7l5 5v9a2 2 0 01-2 2zM14 5v5h5" />,
        sparkles: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4m5-2l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3zm6 9l.9 2.6L21.5 16l-2.6.9L18 19.5l-.9-2.6-2.6-.9 2.6-.9L18 12.5z" />,
        chat: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m7-2a8 8 0 11-3.04-6.27A8 8 0 0120 12zm0 0v7l-4.2-2.1" />,
        wallet: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h13a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 2h17m-4 4h2" />,
    };
    return <svg className={className} {...common}>{paths[icon]}</svg>;
}

export default function Navbar() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    const isActive = (href) => href === '/' ? router.pathname === '/' : router.pathname.startsWith(href);

    const handleLogout = () => {
        localStorage.removeItem('admin_password');
        window.location.reload();
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/95 backdrop-blur-lg border-b border-dark-border">
            <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between relative">
                <button
                    className="lg:hidden z-50 p-2 -ml-2 text-gray-300 hover:text-white"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Toggle navigation"
                >
                    {isOpen ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    )}
                </button>

                <Link href="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:static lg:translate-x-0 lg:translate-y-0 flex items-center gap-2 z-50 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center">
                        <NavIcon icon="photo" className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-lg whitespace-nowrap">SliderApp</span>
                </Link>

                <div className="hidden lg:flex items-center gap-2 min-w-0 ml-4">
                    <div className="flex items-center gap-1 min-w-0">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${isActive(item.href) ? 'nav-link-active' : 'nav-link'} !px-2 xl:!px-3 text-sm whitespace-nowrap`}
                            >
                                <NavIcon icon={item.icon} className="w-4 h-4 xl:w-5 xl:h-5 shrink-0" />
                                <span className="hidden xl:inline">{item.label}</span>
                            </Link>
                        ))}
                    </div>
                    <div className="flex items-center border-l border-white/10 pl-2 ml-1">
                        <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white transition-colors" title="Logout">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>

                {isOpen && <div className="fixed inset-0 h-[100dvh] bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)} />}

                <div className={`fixed top-0 left-0 h-[100dvh] w-72 bg-zinc-900 border-r border-white/10 z-[60] transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="p-6 flex flex-col h-full overflow-y-auto">
                        <div className="flex justify-between items-center mb-8 shrink-0">
                            <span className="font-bold text-xl">Menu</span>
                            <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-white" aria-label="Close menu">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors ${isActive(item.href) ? 'bg-white/5 text-primary' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <NavIcon icon={item.icon} />
                                    {item.label}
                                </Link>
                            ))}
                        </div>

                        <div className="h-px bg-white/10 my-5" />
                        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-slate-400 hover:text-white hover:bg-white/5 mt-auto">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
