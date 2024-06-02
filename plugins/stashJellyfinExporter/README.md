# Stash Jellyfin Exporter

This script interfaces with Stash and its GraphQL API to export scene metadata from Stash and create accompanying `movie.nfo` files, `poster.jpg`, and `fanart.jpg` images. It also creates a new subdirectory for each scene named after the associated file's basename. Additionally, it handles performer images for Jellyfin.

## Requirements

`pip install requests`
`pip install stashapp-tools`

## Configuration

Update the `CONFIG` dictionary in the `stashJellyfinExporter.py` script with the following values:
- `PEOPLE_DIR`: The directory path where performer images are stored.
- `EXCLUDED_PATHS`: A list of paths to exclude from processing.
- `DRY_RUN`: Set to `True` for a dry run (no changes will be made), or `False` to execute the changes.

## Usage

After setting up the `EXCLUDED_PATHS` run the `Restructure Library` task in the `Plugins > Tasks` section.

## Script Details

## Functions

- **check_and_download_images**: Checks and downloads `poster.jpg` and `fanart.jpg` images.
- **process_performer**: Processes and downloads performer images.
- **process_scenes**: Processes scenes, handles moving files, creating directories, downloading images, and creating `nfo` files.

## Workflow

1. Fetch all scenes from the Stash server using a GraphQL query.
2. Iterate through each scene and process it:
    - Check if the scene's file path is excluded.
    - Check if the scene is already in a directory named after its basename and if the images are larger than 50KB.
    - If the conditions are met, skip processing.
    - Otherwise, move the scene file to a new subdirectory, create the necessary directory structure, and process the scene:
        - Create the `movie.nfo` file.
        - Download `poster.jpg` and `fanart.jpg`.
        - Process and download performer images.
3. Update progress after processing each scene.
