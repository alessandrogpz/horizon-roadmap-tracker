# Install it on a phone

Two ways. Both give the full app; the Android build adds four platform
features the browser cannot reach.

## As a PWA (Android and iOS)

The website installs as a standalone app with the full feature set: the
consistency grid, the stacked all-tracks view, per-track colours and offline
storage.

1. Open <https://horizonroadmap.com> on your phone, in Chrome or Safari.
2. Open the browser menu and choose **Add to Home screen** or **Install app**.
3. Launch it from the home screen. It runs full-screen, with no address bar.

## As the Android app

`mobile/` is a native app built with React Native and Expo, sharing this
repository's `lib/` unchanged.

It has everything the website has, arranged for a phone rather than a desk:

- **My Space** is the home screen: the track as a single column of panels you
  can reorder. Which panels exist follows the account; their order is stored
  per device, since one column and two columns need different orders.
- **Screens open read-only.** Anything that can change a plan sits behind an
  edit control, because a touch screen has no hover state to distinguish an
  editable field from a label.

## What the Android app adds over the PWA

Four things a browser cannot reach:

| | |
|---|---|
| **Step counter** | Health Connect for whole days, the sensor for live movement |
| **Share sheet** | send a link into a track's materials |
| **Deep links** | `horizon://track/<id>` |
| **Backups** | written through Android's Storage Access Framework |

Everything else is the same code.

## Building and releasing it

JavaScript changes reach installed phones over the air; native ones need a new
build. The dev loop, when a rebuild is unavoidable, the two build variants and
the Google credentials each one needs are in
[`../mobile/README.md`](../mobile/README.md).
