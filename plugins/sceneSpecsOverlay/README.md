# sceneSpecsOverlay

A [Stash](https://github.com/stashapp/stash) plugin that replaces the native scene specs overlay with a clean, compact at-a-glance panel that fades in when you hover over a scene card.

---

## Features

- Built entirely with the **PluginApi** — no DOM scraping, no MutationObserver
- Fades in smoothly on scene card hover via CSS
- Hides Stash's built-in overlay and renders its own richer replacement
- **Two-line layout** keeps information dense without clutter:
  - **Line 1** — Resolution label · Duration · File size
  - **Line 2** — Video/Audio codec · Bitrate · Frame rate
- All data comes directly from `props.scene.files[0]` — no extra GraphQL requests needed
- Resolution labels match Stash's native conventions (`360p` → `1080p` → `4K` → `8K`)

---

## Preview

```
┌─────────────────────────────┐
│  [scene thumbnail]          │
│                             │
│                             │
│  1080p · 1:23:45 · 4.20 GB  │  ← Line 1
│  H264 / AAC · 8.5 Mbps · 29.97 fps │  ← Line 2
└─────────────────────────────┘
```

Panel fades in on hover, fades out on mouse leave.

---

## Installation

1. Add this index as a new source in your Stash Settings > Plugins > Add Source: [Index](https://serechops.github.io/Serechops-Stash/index.yml)

No configuration required — the plugin works immediately after enabling.

---

## Files

| File | Purpose |
|------|---------|
| `sceneSpecsOverlay.js` | Plugin logic — patches `SceneCard.Overlays` via PluginApi |
| `sceneSpecsOverlay.css` | Panel layout, fade animation, monospace spec values |
| `sceneSpecsOverlay.yml` | Plugin manifest |

---

## How It Works

The plugin uses `PluginApi.patch.after('SceneCard.Overlays', ...)` to append a `SceneSpecsPanel` React component alongside the existing card overlays. The component reads directly from the scene object already present in the card props — specifically `scene.files[0]` which contains all `VideoFile` fields (`video_codec`, `audio_codec`, `frame_rate`, `bit_rate`, `width`, `height`, `duration`, `size`) as part of Stash's standard `SlimSceneData` fragment.

The CSS positions the panel absolutely at the bottom of `.thumbnail-section` and uses `opacity` transition triggered by `.thumbnail-section:hover` — no JavaScript event listeners involved.

---

## Compatibility

Requires a Stash build that exposes `PluginApi` with `patch.after` support (v0.27.0+).
