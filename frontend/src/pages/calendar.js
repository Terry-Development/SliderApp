import { useState, useEffect } from 'react';
import Head from 'next/head';
import AuthWrapper from '@/components/AuthWrapper';
import Navbar from '@/components/Navbar';
import CalendarView from '@/components/CalendarView';
import { API_URL, getAuthHeaders } from '@/utils/api';

export default function CalendarPage() {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDateImages, setSelectedDateImages] = useState(null); // For modal
    const [viewingImage, setViewingImage] = useState(null); // For lightbox
    const [caption, setCaption] = useState(''); // Caption for selected date
    const [savingCaption, setSavingCaption] = useState(false);

    useEffect(() => {
        fetchImages();
    }, []);

    const fetchImages = async () => {
        try {
            // Fetch ALL images for the calendar
            const res = await fetch(`${API_URL}/images?folder=All`, {
                headers: getAuthHeaders(),
                cache: 'no-store'
            });
            const data = await res.json();

            if (Array.isArray(data)) {
                // Backend already returns createdAt with the correct date
                setImages(data);
                console.log('Calendar loaded', data.length, 'images');
            }
        } catch (err) {
            console.error('Calendar fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDateClick = async (dateImages) => {
        // Show modal with all images from this date
        if (dateImages.length > 0) {
            setSelectedDateImages(dateImages);

            // Fetch caption for this date
            const dateStr = dateImages[0].createdAt.split('T')[0];
            try {
                const res = await fetch(`${API_URL}/date-captions/${dateStr}`, {
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                setCaption(data.caption || '');
            } catch (err) {
                console.error('Failed to fetch caption:', err);
                setCaption('');
            }
        }
    };

    const saveCaption = async (dateStr, newCaption) => {
        setSavingCaption(true);
        try {
            await fetch(`${API_URL}/date-captions/${dateStr}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ caption: newCaption })
            });
        } catch (err) {
            console.error('Failed to save caption:', err);
        } finally {
            setSavingCaption(false);
        }
    };

    const formatDate = (isoString) => {
        try {
            return new Date(isoString).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return isoString;
        }
    };

    return (
        <AuthWrapper>
            <Head>
                <title>Calendar | SliderApp</title>
            </Head>

            <div className="min-h-screen bg-dark-bg text-white pb-20">
                <Navbar />

                <main className="max-w-7xl mx-auto px-4 pt-24">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent-purple">
                            Memories Calendar
                        </h1>
                        <p className="text-slate-400 mt-2">Explore your photos by date</p>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-xl">
                            <CalendarView
                                images={images}
                                onDateClick={handleDateClick}
                            />
                        </div>
                    )}
                </main>
            </div>

            {/* Date Images Modal */}
            {selectedDateImages && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 overflow-y-auto">
                    <div className="min-h-screen p-4 flex items-start justify-center">
                        <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-6xl my-8">
                            {/* Header */}
                            <div className="p-6 border-b border-dark-border">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold">
                                            {formatDate(selectedDateImages[0].createdAt)}
                                        </h2>
                                        <p className="text-slate-400 text-sm mt-1">
                                            {selectedDateImages.length} {selectedDateImages.length === 1 ? 'photo' : 'photos'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedDateImages(null)}
                                        className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Caption Editor */}
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-400">Memory Caption</label>
                                    <textarea
                                        value={caption}
                                        onChange={(e) => setCaption(e.target.value)}
                                        onBlur={() => saveCaption(selectedDateImages[0].createdAt.split('T')[0], caption)}
                                        placeholder="Write something about this day..."
                                        className="w-full bg-dark-bg border border-dark-border rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                                        rows={3}
                                    />
                                    {savingCaption && <p className="text-xs text-primary animate-pulse">Saving...</p>}
                                </div>
                            </div>

                            {/* Image Grid */}
                            <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {selectedDateImages.map(img => (
                                    <div
                                        key={img.id}
                                        onClick={() => setViewingImage(img)}
                                        className="aspect-square rounded-xl overflow-hidden bg-black/20 cursor-pointer group relative hover:ring-2 hover:ring-primary transition-all"
                                    >
                                        <img
                                            src={img.url}
                                            alt={img.title || 'Photo'}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                        />
                                        {img.title && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                <p className="text-white text-sm font-medium truncate">{img.title}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox for Individual Image */}
            {viewingImage && (
                <div
                    className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4"
                    onClick={() => setViewingImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-[70]"
                        onClick={() => setViewingImage(null)}
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="max-w-7xl max-h-[90vh] relative" onClick={e => e.stopPropagation()}>
                        <img
                            src={viewingImage.url}
                            alt={viewingImage.title}
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        />
                        {(viewingImage.title || viewingImage.description) && (
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white rounded-b-lg">
                                {viewingImage.title && <h3 className="text-xl font-bold">{viewingImage.title}</h3>}
                                {viewingImage.description && <p className="text-sm text-slate-300">{viewingImage.description}</p>}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AuthWrapper>
    );
}
