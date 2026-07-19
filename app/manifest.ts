import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Engine Dev Tracker',
    short_name: 'DevTracker',
    description: '12-month Graphics & Engine Developer Path Tracker',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'window-controls-overlay', 'minimal-ui'],
    background_color: '#09090b',
    theme_color: '#0ea5e9',
    lang: 'en-US',
    dir: 'ltr',
    orientation: 'any',
    categories: ['productivity', 'education', 'utilities'],
    prefer_related_applications: false,
    launch_handler: {
      client_mode: 'focus-existing',
    },
    icons: [
      {
        src: '/icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'any',
      },
      {
        src: '/icon.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      }
    ],
    screenshots: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Desktop Dashboard'
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Mobile App View'
      }
    ],
    shortcuts: [
      {
        name: 'Roadmap Timeline',
        url: '/roadmap',
        description: 'View the 12-month graphics developer path'
      },
      {
        name: 'DSA Guide',
        url: '/dsa',
        description: 'Open the Data Structures & Algorithms guide'
      }
    ]
  };
}
