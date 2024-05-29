# Stash Timestamps

Adds timestamps to the details of each scene that contains markers in your Stash.

## Config

Please change this portion of the script to match your specific server.

```
# Define the GraphQL endpoint
graphql_url = "http://localhost:9999/graphql"
```

## Features

- Fetches all scenes with their markers and details.
- Adds timestamps in YouTube format (e.g., `MM:SS - Label` or `HH:MM:SS - Label`) to scene descriptions.
- Includes a "Timestamps" heading before the timestamps for easy identification.
- Skips scenes that already contain the "Timestamps" heading.
- Provides functionality to remove the "Timestamps" section from scene descriptions.
- Tracks progress and logs detailed information about the script's execution.

## Requirements

`pip install requests`

## Explanation

Run the task `Create TimeStamps` to create timestamps for all of your scenes in your collection, and run the `Remove Timestamps` to delete them all.
