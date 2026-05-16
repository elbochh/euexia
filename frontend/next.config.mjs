// BACKEND_URL is the internal backend URL used server-side for the API proxy rewrite.
// It is not exposed to the browser; only used by Next.js on the server.
// It is set to the backend Cloud Run URL in production.
const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ||
  'http://localhost:8080';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Proxy all /api/* requests through Next.js so the browser can call the same origin.
  // The browser calls https://your-cloud-run-frontend.run.app/api/...
  // Next.js rewrites that server-side to the backend Cloud Run service.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*.run.app' },
    ],
  },

  webpack: (config, { isServer }) => {
    // Handle three.js and its examples
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
