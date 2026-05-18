import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vesper/ui', '@vesper/shared'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
