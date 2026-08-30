/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  output: 'export',
  basePath: '/businessos',
  images: { unoptimized: true },
};

module.exports = nextConfig;
