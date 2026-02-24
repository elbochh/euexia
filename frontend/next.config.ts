import type { NextConfig } from 'next';

// BACKEND_URL is the internal EB URL used server-side for the API proxy rewrite.
// It is NOT exposed to the browser — only used by Next.js on the server.
// Example: http://euexia-backend-env-1.eba-8trr2mdg.us-east-2.elasticbeanstalk.com
const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ||
  'http://localhost:8080';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Proxy all /api/* requests through Next.js so the browser never calls EB directly.
  // The browser calls https://your-amplify-app.com/api/... (always HTTPS).
  // Next.js server-side rewrites that to http://your-eb-url/api/... (server → server, no mixed content).
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
      { protocol: 'https', hostname: '*.elasticbeanstalk.com' },
      { protocol: 'http', hostname: '*.elasticbeanstalk.com' },
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
