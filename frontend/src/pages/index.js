import { useState, useEffect } from 'react';
import Head from 'next/head';
import AuthWrapper from '@/components/AuthWrapper';
import Navbar from '@/components/Navbar';
import ImageSlider from '@/components/ImageSlider';
import { API_URL, getAuthHeaders } from '@/utils/api';

export default function Home() {
  const [images, setImages] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchAlbums();
    // fetchImages('All'); // REMOVED: Wait for album list
  }, []);

  const fetchAlbums = async () => {
    try {
      const res = await fetch(`${API_URL}/albums`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setAlbums(data);
        // Default to the first album immediately
        const defaultAlbum = data[0];
        setSelectedAlbum(defaultAlbum);
        fetchImages(defaultAlbum);
      } else {
        setLoading(false); // No albums found
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchImages = async (folder) => {
    if (!folder) return;
    setLoading(true);
    try {
      const query = `?folder=${encodeURIComponent(folder)}`;
      const res = await fetch(`${API_URL}/images${query}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        setImages(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAlbumSelect = (album) => {
    setSelectedAlbum(album);
    setIsDropdownOpen(false);
    fetchImages(album);
  };

  return (
    <AuthWrapper>
      <Head>
        <title>Slider - SliderApp</title>
      </Head>

      <Navbar />

      <main className="h-screen pt-16 relative">

        {/* Custom Album Filter - Top Right */}
        <div className="absolute top-20 right-4 z-50 flex flex-col items-end">
          {/* Trigger Button */}
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3 px-4 py-2 shadow-lg shadow-black/20 hover:bg-black/50 transition-all group active:scale-95"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-primary/20 transition-colors">
              <svg className="w-3.5 h-3.5 text-white group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            </div>
            <span className="text-white text-sm font-medium pr-1">{selectedAlbum || 'Select Album'}</span>
            <svg className={`w-3 h-3 text-white/50 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="mt-2 w-48 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                {albums.length > 0 ? (
                  albums.map(album => (
                    <button
                      key={album}
                      onClick={() => handleAlbumSelect(album)}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/10 flex items-center justify-between ${selectedAlbum === album ? 'text-primary bg-white/5' : 'text-slate-300'}`}
                    >
                      <span className="truncate">{album}</span>
                      {selectedAlbum === album && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-slate-500 text-center">No albums found</div>
                )}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-full flex items-center justify-center bg-dark-bg text-white">
            <div className="animate-pulse text-slate-400 flex flex-col items-center">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              Loading Photos...
            </div>
          </div>
        ) : (
          <ImageSlider images={images} />
        )}
      </main>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 text-center py-4 text-slate-600 text-xs bg-gradient-to-t from-black to-transparent pointer-events-none z-50">
        © 2026 SLIDERAPP
      </div>
    </AuthWrapper>
  );
}
