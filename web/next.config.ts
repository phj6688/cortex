import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3481';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/trpc/:path*', destination: `${backendUrl}/trpc/:path*` },
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
