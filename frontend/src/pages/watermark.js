import Head from 'next/head';
import { useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import AuthWrapper from '@/components/AuthWrapper';

function formatWatermarkDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
}

export default function WatermarkPage() {
    const canvasRef = useRef(null);
    const inputRef = useRef(null);
    const [fileName, setFileName] = useState('');
    const [hasImage, setHasImage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const processFile = (file) => {
        if (!file || !file.type?.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                const shortestSide = Math.min(img.width, img.height);
                const fontSize = Math.max(shortestSide * 0.025, 24);
                ctx.font = `500 ${fontSize}px "Segoe UI", Roboto, Helvetica, sans-serif`;
                ctx.fillStyle = 'white';
                ctx.textBaseline = 'bottom';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                const padding = fontSize * 1.2;
                ctx.textAlign = 'left';
                ctx.fillText('XIAOMI 14T', padding, canvas.height - padding);
                ctx.textAlign = 'right';
                ctx.fillText(formatWatermarkDate(), canvas.width - padding, canvas.height - padding);

                setFileName(file.name);
                setHasImage(true);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas || !hasImage) return;
        const link = document.createElement('a');
        const stem = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'photo';
        link.download = `${stem}_watermarked.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
    };

    const clearImage = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = 0;
            canvas.height = 0;
        }
        if (inputRef.current) inputRef.current.value = '';
        setFileName('');
        setHasImage(false);
    };

    return (
        <AuthWrapper>
            <Head>
                <title>Photo Watermark | SliderApp</title>
                <meta name="description" content="Add the Xiaomi 14T watermark and timestamp to a photo." />
            </Head>
            <Navbar />
            <main className="min-h-screen pt-24 pb-12 px-4 bg-dark-bg">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 text-primary-light text-sm font-medium mb-2">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            Photo tools
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold">Photo Watermark</h1>
                        <p className="text-slate-400 mt-2">Adds the same XIAOMI 14T label and current timestamp as your original watermark tool.</p>
                    </div>

                    <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
                        <section className="card-dark p-5 lg:sticky lg:top-24">
                            <h2 className="font-semibold text-lg mb-4">Choose a photo</h2>
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    processFile(e.dataTransfer.files?.[0]);
                                }}
                                className={`w-full min-h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center p-5 transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-dark-border bg-dark-bg/60 hover:border-primary/70 hover:bg-primary/5'}`}
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center mb-3 shadow-lg shadow-primary/20">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <span className="font-medium">Select or drop image</span>
                                <span className="text-xs text-slate-500 mt-1">JPEG, PNG, WEBP and browser-supported images</span>
                            </button>
                            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => processFile(e.target.files?.[0])} />

                            {fileName && <div className="mt-3 px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-sm text-slate-300 truncate">{fileName}</div>}

                            <div className="mt-5 space-y-3">
                                <div className="rounded-lg bg-dark-bg/70 border border-dark-border p-3 text-sm">
                                    <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Bottom left</div>
                                    <div className="font-medium">XIAOMI 14T</div>
                                </div>
                                <div className="rounded-lg bg-dark-bg/70 border border-dark-border p-3 text-sm">
                                    <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Bottom right</div>
                                    <div className="font-medium">Current date &amp; time</div>
                                </div>
                            </div>

                            <div className="mt-5 flex flex-col gap-2">
                                <button disabled={!hasImage} onClick={handleDownload} className="btn-gradient disabled:opacity-40 disabled:cursor-not-allowed w-full flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" /></svg>
                                    Download Image
                                </button>
                                {hasImage && <button onClick={clearImage} className="w-full py-3 px-4 rounded-lg border border-dark-border text-slate-300 hover:text-white hover:bg-white/5 transition-colors">Clear photo</button>}
                            </div>
                        </section>

                        <section className="card-dark min-h-[420px] p-3 md:p-5 flex items-center justify-center overflow-hidden">
                            <canvas ref={canvasRef} className={`${hasImage ? 'block' : 'hidden'} max-w-full max-h-[72vh] h-auto rounded-lg shadow-2xl`} />
                            {!hasImage && (
                                <div className="text-center max-w-sm py-20 px-6">
                                    <div className="w-16 h-16 mx-auto rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center text-slate-500 mb-4">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <h3 className="font-semibold text-lg">Your preview will appear here</h3>
                                    <p className="text-slate-500 text-sm mt-2">Everything is processed locally in your browser. The photo is not uploaded to the backend.</p>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </main>
        </AuthWrapper>
    );
}
