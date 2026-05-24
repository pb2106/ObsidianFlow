/** @type {import('next').NextConfig} */
const nextConfig = {
    // Strip "X-Powered-By: Next.js" from all responses
    poweredByHeader: false,

    // Disable source maps in production (prevents source reconstruction)
    productionBrowserSourceMaps: false,

    // Security headers applied to every page response
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    // Prevent clickjacking
                    { key: 'X-Frame-Options', value: 'DENY' },
                    // Stop MIME sniffing
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    // Minimal referrer info
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    // HSTS (1 year, include subdomains)
                    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
                    // Restrict powerful browser features
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
                    },
                    // Content-Security-Policy
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            // Styles — allow self + Google Fonts
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            // Fonts
                            "font-src 'self' https://fonts.gstatic.com",
                            // Scripts — self + inline (Next.js needs unsafe-inline for hydration)
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                            // Images — self + data URIs
                            "img-src 'self' data: blob:",
                            // XHR/fetch — self only (update if using external APIs)
                            "connect-src 'self'",
                            // Block all plugins
                            "object-src 'none'",
                            // No base override
                            "base-uri 'self'",
                            // Prevent framing
                            "frame-ancestors 'none'",
                        ].join('; '),
                    },
                    // Cross-Origin Isolation
                    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                    { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
                    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
                ],
            },
            // Cache-Control: no-store on all API routes
            {
                source: '/api/(.*)',
                headers: [
                    { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
                    { key: 'Pragma', value: 'no-cache' },
                ],
            },
        ];
    },

    // Webpack: disable source maps in production
    webpack(config, { dev }) {
        if (!dev) {
            config.devtool = false;
        }
        return config;
    },
};

export default nextConfig;
