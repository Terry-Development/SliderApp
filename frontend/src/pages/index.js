import { useState, useEffect } from 'react';
import Head from 'next/head';
import AuthWrapper from '@/components/AuthWrapper';
import Navbar from '@/components/Navbar';
import ImageSlider from '@/components/ImageSlider';
import { API_URL, getAuthHeaders } from '@/utils/api';

export default function Home() {
  const [images, setImages] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlbums();
    fetchImages('All');
  }, []);

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
    setLoading(true);
    try {
      const query = folder && folder !== 'All' ? `?folder=${encodeURIComponent(folder)}` : '?folder=All';
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

  const handleAlbumChange = (e) => {
    const album = e.target.value;
    setSelectedAlbum(album);
    fetchImages(album);
  };

  return (
    <AuthWrapper>
      <Head>
        <title>Slider - SliderApp</title>
      </Head>

      <Navbar />

      <main className="h-screen pt-16 relative">

        {/* Album Filter - Floating Top Right */}
        <div className="absolute top-20 right-4 z-40 bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          <select
            className="bg-transparent text-white text-sm outline-none cursor-pointer"
            value={selectedAlbum}
            onChange={handleAlbumChange}
          >
            <option value="All" className="bg-dark-bg text-white">All Photos</option>
            {albums.map(album => (
              <option key={album} value={album} className="bg-dark-bg text-white">{album}</option>
            ))}
          </select>
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
