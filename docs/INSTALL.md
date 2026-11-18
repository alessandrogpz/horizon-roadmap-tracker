# Install it on a phone

Two ways, and the website is not the lesser one.

## As a PWA (Android and iOS)

The website installs as a standalone app and is a complete way to use Horizon
rather than a preview of one: the consistency grid, the stacked all-tracks
view, tracks in their own colours and offline storage are all there.

1. Open <https://horizonroadmap.com> on your phone, in Chrome or Safari.
2. Open the browser menu and choose **Add to Home screen** or **Install app**.
3. Launch it from the home screen. It runs full-screen, with no address bar.

## As the Android app

`mobile/` is a real Android app, not a wrapper: React Native and Expo, sharing
this repository's `lib/` unchanged.

It has everything the website has, arranged for a phone rather than a desk:

- **My Space** is the home — the whole track as a column of panels you drag
  into the order you want. Which panels you have follows the account; the order
  is the phone's own, because one column and two columns are different
  questions.
- **Reading is the default.** Every screen that can change a plan opens
  read-only behind a pencil, because a touch screen has no hover and an
  editable field looks identical to a label until one of them moves.

## What the Android app adds over the PWA

Only the things a browser cannot reach:

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
