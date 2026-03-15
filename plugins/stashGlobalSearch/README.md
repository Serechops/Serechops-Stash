# Stash Global Search

A fast, keyboard-driven global search modal for [Stash](https://github.com/stashapp/stash) that searches across all entity types in a single request and displays results in a magazine-style grid.

---

## Features

- **`Ctrl+K`** opens the modal from anywhere in the app; `Esc` or clicking the backdrop closes it
- A magnifying glass button is injected into the top navbar as an alternative trigger
- **Single batched GraphQL query** — all five entity types fetched in one round-trip
- **Magazine grid layout**
  - Performers
  - Studios
  - Tags & Navigation — flowing chip pills
- **Scene hover preview** — plays the sprite/preview video on hover; falls back to the static screenshot if no preview is available or the video fails to load
- **System navigation** — pages and settings tabs are matched client-side instantly (no API call)
- Per-entity sort orders: scenes/galleries by `created_at DESC`, performers by `rating DESC`, studios/tags by `name ASC`
- Count badge per section; **"See all N results →"** link when more results exist
- Performer `alias_list` shown as sub-text; untitled scenes fall back to file path
- Keyboard navigation with `↑` / `↓` / `Enter`; 150 ms debounce on input

---

## Installation

1. Add this index as a new source in your Stash Settings > Plugins > Add Source: [Index](https://serechops.github.io/Serechops-Stash/index.yml)

---

## Usage

| Action | Shortcut |
|---|---|
| Open / toggle modal | `Ctrl+K` or navbar button |
| Navigate results | `↑` / `↓` |
| Open focused result | `Enter` |
| Close modal | `Esc` |
| Clear input | Click `×` |

Type at least **2 characters** to trigger a search. Navigation items (pages, settings tabs) appear immediately without waiting for the API.

---

## Support

If you find this plugin useful, consider supporting development on [Patreon](https://www.patreon.com/c/Creat1veB1te).
