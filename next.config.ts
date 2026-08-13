import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  sassOptions: { includePaths: [path.join(__dirname, 'styles')] },
  images: {
    remotePatterns: [
      // Google account profile pictures.
      { protocol: 'https', hostname: '*.googleusercontent.com', port: '', pathname: '/**' }
    ]
  }
};

export default nextConfig;
