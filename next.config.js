/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dev-only: let LAN devices (phone testing) reach HMR/dev resources.
  allowedDevOrigins: ['192.168.64.*'],
  async headers() {
    return [
      {
        // The service worker must never be cached, or browsers keep running
        // a stale version long after a deploy.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
