import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Horizon: Roadmap Tracker',
    short_name: 'Horizon',
    description: 'Personal roadmap and consistency engine. Active Track: Game Engine Development',
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
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
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
