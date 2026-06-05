import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Engine Dev Tracker',
    short_name: 'DevTracker',
    description: '12-month Graphics & Engine Developer Path Tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#0ea5e9',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
