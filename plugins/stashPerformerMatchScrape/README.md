# Stash Matched Performer Scrape

This script updates performer data in Stash by matching and merging data from TPDB and StashDB. It can update all performers in the collection or a single performer triggered by a `Performer.Create.Post` hook.

## Features

- Scrapes performer data from ThePornDB (TPDB) and StashDB.
- Merges data from both sources, prioritizing StashDB data if available.
- Adds or updates stash IDs from TPDB and StashDB.
- Supports updating all performers in the collection or a single performer via a hook.

## Configuration

Update the `config` dictionary in the script with your API keys and Stash server details:

```python
config = {
    'scheme': 'http',
    'host': 'localhost',
    'port': 9999,
    'api_key': '',  # Your Stash API key
    'tpdb_api_key': 'YOUR_TPDB_API_KEY',  # Your TPDB API key
    'stashdb_api_key': 'YOUR_STASHDB_API_KEY',  # Your stashDB API key
}
```

## Updating All Performers

To update all performers in your Stash collection, run the `Scrape All Performers` task in the `Settings > Tasks` section.

## Performers Scraped Automatically

On a `Performer.Create.Post` the plugin will attempt to name match your created performer to both StashDB and TPDB. If a name match is made, it will scrape from one, or both sources, and merge the data into your newly created performer.

