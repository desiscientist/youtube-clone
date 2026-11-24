/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // ffmpeg-static finds its ffmpeg program relative to its own folder.
    // Bundling it moves the code into .next/ and breaks that path, so every
    // upload failed with "spawn …\.next\server\vendor-chunks\ffmpeg.exe ENOENT".
    // Loading it straight from node_modules keeps the path correct.
    serverComponentsExternalPackages: ["ffmpeg-static"],
  },
};

export default nextConfig;
