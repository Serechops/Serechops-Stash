# Stash Tag Performer Image

This script updates an image in Stash by associating it with a performer based on the parent directory name of the image file. The script is designed to be triggered by an `Image.Update.Post` hook in Stash.

## Configuration

- **API_ENDPOINT**: The endpoint for the GraphQL API (default: `http://localhost:9999/graphql`).
- **API_KEY**: Your API key, if required for the GraphQL endpoint.

## Dependencies

The script requires the following Python libraries:
- `requests`
- `stashapp-tools`
- `pathlib`

## How It Works
- The script reads the hook context from stdin to get the image ID.
- It queries the GraphQL API to get the parent directory path of the image.
- It checks if the parent directory name matches any performer names in the local database.
- If a match is found, it updates the image to include the performer ID.

## Usage

Simply start adding new images to Stash via scanning them and the script will trigger on `Image.Create.Post` and perform checks to try and match performers to your images.
