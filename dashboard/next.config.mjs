/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dashboard talks to the backend directly with a bearer token; the backend
  // URL is provided at build/runtime via NEXT_PUBLIC_BACKEND_URL.
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8787',
  },
};

export default nextConfig;
