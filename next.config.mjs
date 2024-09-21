// import WebpackObfuscator from 'webpack-obfuscator';

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   async rewrites() {
//     return [
//       {
//         source: '/ws',
//         destination: 'http://localhost:3000/api/websocket',
//       },
//     ];
//   },
//   webpack(config, { dev, isServer }) {
//     // Добавляем плагин WebpackObfuscator только для продакшн сборки
//     if (!dev && !isServer) {
//       config.plugins.push(
//         new WebpackObfuscator({
//           rotateStringArray: true,
//         }, ['excluded_bundle_name.js'])
//       );
//     }

//     return config;
//   },
// };

// export default nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/ws',
        destination: 'http://localhost:3000/api/websocket',
      },
    ];
  },
  webpack(config, { dev, isServer }) {
    // Убираем обфускатор, удалив WebpackObfuscator
    return config;
  },
};

export default nextConfig;
