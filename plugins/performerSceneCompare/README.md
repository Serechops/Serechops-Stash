# Performer Scene Compare

This script is designed to compare local performer scenes with those available on StashDB. If there are any missing scenes, the script will create these scenes locally, create a new studio for the performer's missing scenes, and associate the missing scenes with the new studio.

## Features

- Compare local performer scenes with StashDB.
- Automatically create missing scenes locally.
- Create a new studio named after the performer for missing scenes.
- Associate newly created scenes with the new studio.
- Progress tracking for the entire script execution.

## Requirements

`pip install stashapp-tools`

## Configuration

  ```
    LOCAL_GQL_ENDPOINT = "http://localhost:9999/graphql"
    STASHDB_ENDPOINT = "https://stashdb.org/graphql"
    LOCAL_API_KEY = "your_local_api_key"  # Replace with your local API key if needed
    STASHDB_API_KEY = "your_stashdb_api_key"  # Replace with your StashDB API key
```

## Usage

The script is designed to be executed as a plugin within Stash. It is triggered by a performer update post hook. 
