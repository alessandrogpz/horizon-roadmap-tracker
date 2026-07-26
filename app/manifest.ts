import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Horizon: Roadmap Tracker',
    short_name: 'Horizon',
    description: 'Personal roadmap and consistency engine for the goals you\'re working toward.',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'window-controls-overlay', 'minimal-ui'],
    background_color: '#0a0a0c',
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
        // Separate art: Android crops adaptive icons to a circle/squircle, so
        // this variant is full-bleed with the mark inside the safe zone.
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      }
    ],
    shortcuts: [
      {
        name: 'Full Roadmap',
        url: '/roadmap',
        description: 'View your active track\'s full roadmap'
      }
    ]
  };
}
