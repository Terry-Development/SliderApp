import { useState, useEffect } from 'react';
import Head from 'next/head';
import AuthWrapper from '@/components/AuthWrapper';
import Navbar from '@/components/Navbar';
import GalleryGrid from '@/components/GalleryGrid';
import { API_URL, getAuthHeaders } from '@/utils/api';

// Album Card Component with Cover Image Fetching
const AlbumCard = ({ album, onClick }) => {
    const [cover, setCover] = useState(null);

    useEffect(() => {
        const fetchCover = async () => {
            try {
                const res = await fetch(`${API_URL}/images?folder=${encodeURIComponent(album)}&limit=1`, {
                    headers: getAuthHeaders()
                });
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setCover(data[0].url);
                }
            } catch (err) {
                console.error(`Failed to fetch cover for ${album}`, err);
            }
        };
        fetchCover();
    }, [album]);

    return (
        <div
            onClick={() => onClick(album)}
            className="group relative aspect-square bg-dark-card rounded-2xl overflow-hidden cursor-pointer border border-white/5 hover:border-primary/50 transition-all shadow-lg hover:shadow-primary/10"
        >
            {/* Background Image or Fallback */}
            {cover ? (
                <img
                    src={cover}
                    alt={album}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-white/5 group-hover:bg-white/10 transition-colors">
                    <svg className="w-12 h-12 text-slate-500 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {/* Text Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                <h3 className="text-white font-bold text-lg truncate leading-tight shadow-black drop-shadow-md">{album}</h3>
                <div className="h-0.5 w-8 bg-primary mt-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </div>
    );
};

export default function Gallery() {
    const [view, setView] = useState('albums'); // 'albums' | 'images'
    const [currentAlbum, setCurrentAlbum] = useState(null);

    const [albums, setAlbums] = useState([]);
    const [images, setImages] = useState([]);

    const [uploading, setUploading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // Multi-Upload State
    const [pendingUploads, setPendingUploads] = useState([]);
    const [targetAlbum, setTargetAlbum] = useState(''); // Album name for upload

    // Selection / Batch Delete State
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [batchDeleting, setBatchDeleting] = useState(false);

    useEffect(() => {
        fetchAlbums();
    }, []);

    useEffect(() => {
        if (view === 'images') {
            fetchImages(currentAlbum);
        }
    }, [view, currentAlbum]);

    const fetchAlbums = async () => {
        try {
            const res = await fetch(`${API_URL}/albums`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (Array.isArray(data)) setAlbums(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchImages = async (folder) => {
        try {
            // If folder is null, we might want 'All' or just root?
            // Let's pass 'All' or the folder name
            const query = folder ? `?folder=${encodeURIComponent(folder)}` : '?folder=All';
            const res = await fetch(`${API_URL}/images${query}`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (Array.isArray(data)) setImages(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAlbumClick = (album) => {
        setCurrentAlbum(album);
        setView('images');
        setSelectionMode(false);
        setSelectedIds(new Set());
    };

    const handleBackToAlbums = () => {
        setCurrentAlbum(null);
        setView('albums');
        setSelectionMode(false);
        setSelectedIds(new Set());
        fetchAlbums(); // Refresh albums in case new ones were created/deleted
    };

    // --- Batch Operations ---
    const toggleSelection = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} images? This cannot be undone.`)) return;

        setBatchDeleting(true);
        try {
            const res = await fetch(`${API_URL}/images/delete-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            });

            if (res.ok) {
                // Remove from local state immediately
                setImages(prev => prev.filter(img => !selectedIds.has(img.id)));
                setSelectedIds(new Set());
                setSelectionMode(false);
            } else {
                const data = await res.json();
                alert(`Failed to delete some images: ${data.details || data.error || 'Unknown error'}`);
            }
        } catch (err) {
            alert(`Error during batch delete: ${err.message}`);
        } finally {
            setBatchDeleting(false);
        }
    };

    const handleDeleteAlbum = async () => {
        if (!currentAlbum) return;
        const confirmMsg = `DANGER: This will delete the entire album "${currentAlbum}" and ALL visible photos inside it.\n\nAre you absolutely sure?`;
        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch(`${API_URL}/albums/${encodeURIComponent(currentAlbum)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (res.ok) {
                handleBackToAlbums();
            } else {
                const data = await res.json();
                alert(`Failed to delete album: ${data.details || data.error || 'Unknown error'}`);
            }
        } catch (err) {
            alert(`Error deleting album: ${err.message}`);
        }
    };


    // --- Upload Logic ---
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        const newUploads = files.map(file => ({
            file,
            title: '',
            description: '',
            status: 'pending',
            id: Math.random().toString(36).substr(2, 9)
        }));
        setPendingUploads(prev => [...prev, ...newUploads]);
        // Default target album to current album if inside one
        if (currentAlbum) setTargetAlbum(currentAlbum);
    };

    const updateUploadMetadata = (id, field, value) => {
        setPendingUploads(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const removeUpload = (id) => {
        setPendingUploads(prev => prev.filter(item => item.id !== id));
    };

    const handleUploadAll = async () => {
        if (pendingUploads.length === 0) return;
        setUploading(true);

        // Check if album name is provided
        const folderName = targetAlbum.trim() || 'All';

        const uploadPromises = pendingUploads.map(async (item) => {
            if (item.status === 'success') return item;

            const formData = new FormData();
            // MULTER FIX: Append text fields BEFORE the file
            formData.append('title', item.title);
            formData.append('description', item.description);
            formData.append('folder', folderName);
            formData.append('image', item.file);

            try {
                const res = await fetch(`${API_URL}/images/upload`, {
                    method: 'POST',
                    headers: { 'x-admin-password': getAuthHeaders()['x-admin-password'] },
                    body: formData
                });

                if (res.ok) return { ...item, status: 'success' };
                else return { ...item, status: 'error' };
            } catch (err) {
                return { ...item, status: 'error' };
            }
        });

        const results = await Promise.all(uploadPromises);
        setPendingUploads(results);

        // Refresh current view
        if (view === 'images' && currentAlbum === folderName) {
            fetchImages(currentAlbum);
        } else if (view === 'albums') {
            fetchAlbums();
        }

        if (results.every(r => r.status === 'success')) {
            setTimeout(() => {
                setShowModal(false);
                setPendingUploads([]);
                setTargetAlbum('');
            }, 1000);
        }
        setUploading(false);
    };

    const handleDelete = (id) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    return (
        <AuthWrapper>
            <Head>
                <title>Gallery - SliderApp</title>
            </Head>
            <Navbar />

            <main className="min-h-screen pt-20 pb-16">
                <div className="max-w-7xl mx-auto px-4">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            {view === 'images' && (
                                <button
                                    onClick={handleBackToAlbums}
                                    className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                            )}

                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-2">
                                    {view === 'albums' ? 'My Albums' : (currentAlbum || 'All Photos')}
                                </h1>
                                <p className="text-slate-500 text-sm">
                                    {view === 'albums' ? 'Select an album to view photos' : `${images.length} photos`}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {view === 'images' && images.length > 0 && (
                                <>
                                    {selectionMode ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setSelectionMode(false);
                                                    setSelectedIds(new Set());
                                                }}
                                                className="text-slate-400 hover:text-white px-3 font-medium transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleBatchDelete}
                                                disabled={selectedIds.size === 0 || batchDeleting}
                                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {batchDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {/* Delete Album Button (Only for specific folders, not All Photos) */}
                                            {currentAlbum && (
                                                <button
                                                    onClick={handleDeleteAlbum}
                                                    className="text-red-400 hover:text-red-300 px-3 py-2 rounded-lg border border-red-500/30 hover:border-red-500/80 transition-all text-sm font-medium"
                                                    title="Delete Entire Album"
                                                >
                                                    Delete Album
                                                </button>
                                            )}

                                            <button
                                                onClick={() => setSelectionMode(true)}
                                                className="bg-dark-card border border-dark-border text-white px-4 py-2 rounded-lg hover:border-primary transition-colors text-sm font-medium"
                                            >
                                                Select Photos
                                            </button>
                                        </>
                                    )}
                                </>
                            )}

                            <button
                                onClick={() => setShowModal(true)}
                                className="btn-gradient flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="hidden sm:inline">Upload</span>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    {view === 'albums' ? (
                        <div>
                            {albums.length === 0 && (
                                <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center max-w-lg mx-auto mt-10">
                                    <div className="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">No Albums Yet</h3>
                                    <p className="text-slate-400 mb-6">
                                        Albums are created automatically when you upload photos into them.
                                        Click "Upload" and type an Album Name to get started!
                                    </p>
                                    <button
                                        onClick={() => setShowModal(true)}
                                        className="btn-gradient inline-flex items-center gap-2"
                                    >
                                        Create First Album
                                    </button>
                                </div>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {/* Special "All Photos" Folder */}
                                <div
                                    onClick={() => handleAlbumClick(null)}
                                    className="card-dark aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors group"
                                >
                                    <div className="w-20 h-20 rounded-full bg-dark-bg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <h3 className="font-bold text-white text-lg">All Photos</h3>
                                    <span className="text-slate-500 text-sm">View Everything</span>
                                </div>

                                {/* Dynamic Albums */}
                                {albums.map(album => (
                                    <AlbumCard
                                        key={album}
                                        album={album}
                                        onClick={handleAlbumClick}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <GalleryGrid
                            images={images}
                            onDelete={handleDelete}
                            selectionMode={selectionMode}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelection}
                        />
                    )}

                </div>
            </main>

            {/* Upload Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="card-dark w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-dark-border flex items-center justify-between">
                            <h2 className="text-xl font-bold">Upload Photos</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Album Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Target Album / Group</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="input-dark w-full"
                                        placeholder="E.g. Vacation 2024 (Leave empty for General)"
                                        value={targetAlbum}
                                        onChange={(e) => setTargetAlbum(e.target.value)}
                                        list="album-suggestions"
                                    />
                                    <datalist id="album-suggestions">
                                        {albums.map(a => <option key={a} value={a} />)}
                                    </datalist>
                                </div>
                            </div>

                            {/* File Input */}
                            <div className="border-2 border-dashed border-dark-border rounded-xl p-6 text-center hover:border-primary transition-colors">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <div className="flex flex-col items-center">
                                        <svg className="w-10 h-10 text-slate-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <p className="text-slate-400">Add Images</p>
                                    </div>
                                </label>
                            </div>

                            {/* Pending List */}
                            <div className="space-y-4">
                                {pendingUploads.map((item) => (
                                    <div key={item.id} className="bg-dark-bg p-4 rounded-lg border border-dark-border flex gap-4">
                                        <div className="w-16 h-16 bg-black rounded-lg overflow-hidden flex-shrink-0 relative">
                                            <img src={URL.createObjectURL(item.file)} className="w-full h-full object-cover" alt="" />
                                            {item.status === 'success' && <div className="absolute inset-0 bg-green-500/50 flex items-center justify-center">✓</div>}
                                            {item.status === 'error' && <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">!</div>}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <input
                                                type="text" className="input-dark py-1 px-2 text-sm" placeholder="Title"
                                                value={item.title} onChange={e => updateUploadMetadata(item.id, 'title', e.target.value)} disabled={item.status === 'success'}
                                            />
                                            <input
                                                type="text" className="input-dark py-1 px-2 text-sm" placeholder="Description"
                                                value={item.description} onChange={e => updateUploadMetadata(item.id, 'description', e.target.value)} disabled={item.status === 'success'}
                                            />
                                        </div>
                                        <button onClick={() => removeUpload(item.id)} className="text-slate-500 hover:text-red-500" disabled={item.status === 'success'}>×</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 border-t border-dark-border flex gap-4">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 rounded-lg border border-dark-border text-slate-400 hover:text-white"
                                disabled={uploading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadAll}
                                className="flex-1 btn-gradient disabled:opacity-50"
                                disabled={uploading || pendingUploads.length === 0}
                            >
                                {uploading ? 'Uploading...' : 'Start Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthWrapper>
    );
}
