# Stash Right-Click Menu Enhancements

These user scripts add custom right-click menus to `.scene-card`, `.gallery-card`, and `.image-card` elements on the localhost Stash instance. The menus provide options to add tags, performers, and galleries/scenes using GraphQL mutations. The scripts also integrate Tabulator for displaying dynamic search results in a draggable popup window.

## Scripts

### 1. stashRight-Click for Scenes

- **Filename:** stashRight-Click-for-Scenes.user.js
- **Description:** Adds a custom right-click menu to `.scene-card` elements on localhost:9999 with options to add tags, performers, or galleries.
- **Version:** 2.11

### 2. stashRight-Click for Galleries

- **Filename:** stashRight-Click-for-Galleries.user.js
- **Description:** Adds a custom right-click menu to `.gallery-card` elements on localhost:9999 with options to add tags, performers, or scenes.
- **Version:** 1.0

### 3. stashRight-Click for Images

- **Filename:** stashRight-Click-for-Images.user.js
- **Description:** Adds a custom right-click menu to `.image-card` elements on localhost:9999 with options to add tags, performers, or link scenes.
- **Version:** 1.0

## Features

- Custom right-click menu for scenes, galleries, and images.
- Options to add tags, performers, or galleries/scenes using GraphQL mutations.
- Integrated Tabulator for displaying dynamic search results.
- Draggable popup window for selecting and adding items.
- Maintains visibility of the popup window within the viewport.

## Installation

1. Install a user script manager like [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/).
2. Create a new user script and copy the content of the respective script file into it.
3. Save the script and ensure it is enabled.

## Configuration

**The @match config is only needed for userscripts**: Change the `// @match        http://localhost:9999/*` in the script header to match your server address and port.

Find this configuration at the top of each `stashRightClick` userscript and adjust it accordingly.

```
/******************************************
     * USER CONFIGURATION
     ******************************************/
    const userConfig = {
        scheme: 'http', // or 'https'
        host: 'localhost', // Your server IP or hostname
        port: 9999, // Your server port
        apiKey: '' // Your API key
        stashDBApiKey: '' // Your StashDB API Key (only applicable to stashRightClickPerformers currently)
    };
```
## Usage

1. Navigate to your localhost Stash instance.
2. Right-click on a scene, gallery, or image card to open the custom menu.
3. Select an option to add tags, performers, or galleries/scenes.
4. Use the search input to filter and select the items to add.
5. The changes will be applied using GraphQL mutations.


# Performer Merge Tool

The Performer Merge Tool is a userscript that adds a performer merge functionality to the Performers page in Stash. This script allows users to search performers by name or Stash ID and merge performer records while preserving unique information such as aliases, disambiguations, and Stash IDs.

## Features

- Search performers by name or Stash ID.
- Merge performer records while appending unique entries for aliases and disambiguations.
- Preserve and merge Stash IDs, with friendly names for known endpoints (e.g., StashDB, ThePornDB).
- User-friendly modal interface for selecting and merging performers.

## Installation

1. Install a userscript manager extension for your browser like [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/).
2. [Install the Performer Merge Tool userscript]([https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/stashRightClickPerformerMerge.user.js]).

## Configuration

Edit the userscript to configure your server details:

```
javascript
const userConfig = {
    scheme: 'http', // or 'https'
    host: 'localhost', // your server IP or hostname
    port: 9999, // your server port
    apiKey: '' // your API key
};
```

## Usage
- Navigate to the Performers page in Stash.
- Right-click on the "More" button (`...`) to open the custom menu.
- Click on "Merge Performers" to open the merge modal.
- Search for performers by name or Stash ID in the left and right search fields.
- Select the performers to compare and merge.
- Click on "Merge Left to Right" or "Merge Right to Left" to perform the merge.

## Note

When deciding on which direction to merge please keep in mind that the `starting` direction will be destroyed after the merge is complete.
`LEFT > RIGHT = LEFT IS DESTROYED, RIGHT > LEFT = RIGHT IS DESTROYED`
