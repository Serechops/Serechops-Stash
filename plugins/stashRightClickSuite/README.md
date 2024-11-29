# Stash Right Click Galleries

This script enhances gallery management by integrating dynamic menus, popups, and interactive tables.

## Features

- **Dynamic Menu Integration:** Adds a context menu to gallery cards for easy access to management options.
- **Interactive Popups:** Uses draggable popups for adding tags, performers, or scenes to a gallery.
- **GraphQL Integration:** Fetches and updates gallery data (tags, performers, and scenes) using GraphQL queries and mutations.
- **Dynamic Table Rendering:** Displays search results in a fully interactive table powered by Tabulator.
- **Real-Time Feedback:** Uses Toastify for success and error notifications.

# Stash Right Click Images

This script provides advanced features for managing image metadata and associations within a web application. It integrates dynamic context menus, draggable popups, and API-driven updates for tags, performers, scenes, and galleries.

## Features

### Dynamic Configuration
- Automatically fetches configuration details for API keys and endpoints (e.g., StashDB, FansDB, ThePornDB).
- Maps endpoints to user-friendly names for better usability.

### Context Menu
- Adds a custom context menu to image cards, providing actions such as:
  - Viewing image details.
  - Adding tags, performers, or linking scenes.
  - Updating performer images dynamically.
  - Setting gallery cover images.

### Interactive Popups
- Uses draggable popups with search and selection capabilities.
- Integrates **Tabulator** tables for displaying search results.
- Allows adding selected entities (tags, performers, scenes) to images.

# Stash Right Click Performer Merge

This script facilitates merging performers in a Stash-based media management system by utilizing dynamic context menus, draggable modals, and API-based operations. It supports transferring related metadata (e.g., galleries, scenes) between performers and highlights differences for easy comparison.

## Features

### Configuration Management
- Dynamically fetches and updates configuration details for API keys and endpoints (e.g., StashDB, FansDB, TPDB).
- Maps stash box endpoints to user-friendly names.

### Merge Functionality
- Supports merging performers with options to:
  - Highlight differences between selected performers.
  - Transfer related galleries and scenes.
  - Handle duplicate and unique metadata like aliases and stash IDs.

### Dynamic Modals
- Draggable modal interface for:
  - Searching performers by name or stash ID.
  - Comparing performer details side-by-side.
  - Selecting performers for merging.

### Context Menu
- Right-click context menu for:
  - Merging performers.
  - Invoking the modal directly from the performer page.

# Stash Right Click Performers

## **Features**

### **Dynamic Configuration Fetching**
- Automatically retrieves API keys and endpoint configurations:
  - **Local API**: `/graphql`
  - **StashDB**: `https://stashdb.org/graphql`
  - **TPDB**: `https://theporndb.net/graphql`
  - **FansDB**: `https://fansdb.cc/graphql`
- Supports fallback for older domains and dynamically maps endpoints to user-friendly names.

### **Interactive UI Enhancements**
- **Custom Context Menu**:
  - Displays options when right-clicking on performer cards or the detail header image.
  - Includes:
    - **Missing Scenes**: Identify and display missing scenes from StashDB.
    - **Change Image**: Update performer images from StashDB, TPDB, or local galleries.
    - **Auto-Tag**: Automatically apply metadata tags to performers.
    - **Add Tags**: Select and add tags using an interactive popup.
    - **Batch Image Update**: Update images for multiple selected performers.
  - Includes a **Support Link** to the developer’s Patreon.

- **Loading Spinner and Overlay**:
  - Displays a spinner with a slideshow of performer images while fetching data.

### **Scene Management**
- **Missing Scenes Detection**:
  - Fetches scenes from StashDB and compares them with local data.
  - Displays missing scenes in a modal with pagination, sorting, and links to external resources.

- **Scene Comparison**:
  - Compares local scenes with StashDB scenes using titles to identify missing content.

### **Image Management**
- **Image Selection Modal**:
  - Allows users to browse and select performer images from multiple sources.
  - Supports pagination and displays image dimensions when available.

- **Batch Image Updates**:
  - Supports batch processing of performer image updates for selected performers.

### **Tag Management**
- **Tag Selector Popup**:
  - Provides a Tabulator-based UI for searching and selecting tags.
  - Displays recent tags and allows users to apply multiple tags to performers.

- **Auto-Tagging**:
  - Automatically applies tags to performers based on metadata.

# Stash Right Click Scenes

## **Overview**
This script enhances scene management capabilities on a media management platform. It introduces advanced features for tagging, performer management, and gallery linking directly from the user interface.

## **Features**

### **Custom Context Menu**
- **Right-Click Options**:
  - Add **Tags**, **Performers**, and **Galleries** to scenes via a Tabulator-based popup.
  - **Edit Scene**: Opens the scene's edit page and selects the edit tab automatically.
  - **Support Link**: Redirects users to the developer's Patreon page for support.

### **Dynamic GraphQL Integration**
- **Fetch Data**:
  - Tags, Performers, and Galleries based on user search queries.
- **Update Scenes**:
  - Add new tags, performers, and galleries while ensuring no duplicates.
- **Existing Data Retrieval**:
  - Fetch existing tag, performer, and gallery IDs for proper data updates.

### **Interactive Popups**
- **Tabulator Tables**:
  - Searchable and sortable popups for adding tags, performers, and galleries.
  - Draggable popup windows for improved user experience.

# Stash Right Click Settings

## **Overview**
This script adds advanced features for managing settings, plugin tasks, and duplicate scenes.

## **Features**

### **Custom Context Menu**
- **Right-Click Options**:
  - **Run Plugin Task**: Opens a modal to select and run tasks from available plugins.
  - **Edit CSS/JavaScript**: Mimics button clicks to edit custom CSS and JavaScript.
  - **Duplicate Checker**: Identifies duplicate scenes, flagged scenes with no files, and duplicate titles.
  - **Support Link**: Directs users to the developer's Patreon page.

### **Duplicate Checker**
- Identifies:
  - Duplicate files based on SHA-256 fingerprints.
  - Scenes with no associated files.
  - Scenes with duplicate titles.
- Displays results in a modal with options to delete scenes selectively:
  - **Delete Scene and Generated Files**.
  - **Delete Scene, Generated Files, and Local File**.

### **Plugin Task Management**
- Lists plugin tasks grouped by plugin in a modal.
- Tasks are sorted alphabetically by plugin name.
- Runs selected tasks and displays success/error notifications.
