import withPWAInit from 'next-pwa';

// Build-time routing for isolated Vercel PR previews. A preview without an
// explicitly mapped backend must fail closed instead of using production data.
const previewBackends = {
  'feature/discreet-chat-alerts-20261015': 'https://sliderapp-pr-2.onrender.com',
  'feature/chat-seen-reactions-photos-20261026': 'https://sliderapp-pr-4.onrender.com'
};
const isVercelPreview = process.env.VERCEL_ENV === 'preview';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  importScripts: ['/push-sw.js'],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: true,
  output: 'export',
  env: {
    NEXT_PUBLIC_SLIDERAPP_PREVIEW_MODE: isVercelPreview ? 'true' : 'false',
    NEXT_PUBLIC_SLIDERAPP_PREVIEW_API_URL: isVercelPreview
      ? (previewBackends[process.env.VERCEL_GIT_COMMIT_REF] || '')
      : ''
  },
  images: {
    unoptimized: true
  }
};

export default withPWA(nextConfig);
