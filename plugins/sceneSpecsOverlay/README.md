# sceneSpecsOverlay

A [Stash](https://github.com/stashapp/stash) plugin that keeps the native scene specs overlay by default, then swaps to a custom one-line panel on scene-card hover.

---

## Features

- Built entirely with the **PluginApi** — no DOM scraping, no MutationObserver
- Fades in smoothly on scene card hover via CSS
- Keeps Stash's built-in overlay visible until hover, then swaps to the plugin overlay
- **One-line layout** for dense, glanceable metrics:
  - `Resolution · Duration · File Size · Video Codec · Bitrate · FPS`
- All data comes directly from `props.scene.files[0]` — no extra GraphQL requests needed
- Resolution labels match Stash's native conventions (`360p` → `1080p` → `4K` → `8K`)
- Supports configurable token-based ordering/suppression via `Overlay Format`

---

## Preview

```
┌─────────────────────────────────────────────────────┐
│  [scene thumbnail]                                  │
│                                                     │
│  [1080p][1:23:45][4.20 GB][H264][8.5 Mbps][29.97 fps] │
└─────────────────────────────────────────────────────┘
```

Panel fades in on hover, fades out on mouse leave. Native specs are visible when not hovered.

---

## Installation

1. Add this index as a new source in your Stash Settings > Plugins > Add Source: [Index](https://serechops.github.io/Serechops-Stash/index.yml)
2. Enable **Stash Scene Specs Overlay**
3. (Optional) Set `Overlay Format` in plugin settings

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

The CSS positions the panel absolutely at the bottom of `.thumbnail-section` and uses `opacity` transition triggered by `.thumbnail-section:hover` — no JavaScript event listeners involved. On hover, native `.scene-specs-overlay` is hidden and the plugin panel is shown.

## Overlay Format setting

`Overlay Format` is a string setting that defines chip order and optional suppression rules.

- If blank, default format is used:
  - `[Resolution][Duration][FileSize][VideoCodec][BitRate][FPS]`
- Supported tokens:
  - `Resolution`, `Duration`, `FileSize`, `VideoCodec`, `AudioCodec`, `BitRate`, `FPS`
- Suppress token when equal to a value:
  - `[VideoCodec(='AV1')]`
  - `[AudioCodec(='AAC')]`

Examples:

- Default one-line:
  - `[Resolution][Duration][FileSize][VideoCodec][BitRate][FPS]`
- Hide AV1 codec:
  - `[Resolution][Duration][FileSize][VideoCodec(='AV1')][BitRate][FPS]`
- Include audio codec too:
  - `[Resolution][Duration][FileSize][VideoCodec][AudioCodec][BitRate][FPS]`

If any token is invalid, the plugin logs a warning (`console.warn`) and falls back to default format.

---

## Compatibility

Requires a Stash build that exposes `PluginApi` with `patch.after` support (v0.27.0+).
