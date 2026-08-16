/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [
          // Embed routes are meant to be iframed by the customer's own portal from
          // any origin. Deliberately omit X-Frame-Options (there is no standard
          // "allow everyone" value for it) and use the CSP directive instead.
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
