import type { NextConfig } from 'next';

// Parse allowed image hostnames from environment.
// NEXT_PUBLIC_API_URL is e.g. "https://my-env.us-east-1.elasticbeanstalk.com"
const extraImageHostnames: string[] = [];
if (process.env.NEXT_PUBLIC_API_URL) {
  try {
    extraImageHostnames.push(new URL(process.env.NEXT_PUBLIC_API_URL).hostname);
  } catch { /* ignore malformed URL */ }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '*.elasticbeanstalk.com' },
      ...extraImageHostnames.map((hostname) => ({
        protocol: 'https' as const,
        hostname,
      })),
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
