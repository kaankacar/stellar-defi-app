/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/stellar-defi-app' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/stellar-defi-app/' : '',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
