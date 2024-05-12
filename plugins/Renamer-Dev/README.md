# Renamer:

### Requirements

`pip install stashapp-tools`
`pip install python-json-logger`

### Using Renamer-Dev
`*Note: All changes are made when a Scene is updated and saved. Start small, make sure you get the changes you want in place first, then Rename away!`

When you have installed the `Renamer-Dev` plugin, hop into your plugins directory, Renamer folder > open renamer_settings.py with your favorite code/text editor and you'll see this:

```
# Importing config dictionary
# renamer_settings.py
config = {
    "api_key": "",  # Your API key, if needed for the GraphQL endpoint
    "endpoint": "http://localhost:9999/graphql",  # GraphQL endpoint
    "log_path": "./renamer.log",  # Path to log file
    "default_move_path": r"C:\No Studio",  # Default path for moving files
    "wrapper_styles": {
        "studio": ('[', ']'),
        "title": ('[', ']'),
        "performers": ('[', ']'),
        "date": ('[', ']'),
        "height": ('[', ']'),
        "video_codec": ('[', ']'),
        "frame_rate": ('[', ']'),
        "tag": ('[', ']')
    },
    "separator": '-',  # Separator used in filenames
    "key_order": [
        "studio",
        "title",
        "performers",
        "date",
        "height",
        "video_codec",
        "frame_rate",
        "tags"
    ],
    "exclude_keys": [],  # Keys to exclude from filename formation
    "move_files": True,  # Enable moving of files
    "rename_files": True,  # Enable renaming of files
    "dry_run": True,  # Dry run mode
    "max_tag_keys": 5,  # Maximum number of tag keys in filename
    "tag_whitelist": [],  # List of tags to include in filename
    "exclude_paths": [],  # Paths to exclude from processing
    "tag_specific_paths": {
        "Movie": r"E:\Movies"      # Specific paths based on tags
    }                     
}
```

# Renamer Settings File

This settings file (`renamer_settings.py`) controls the behavior of the Renamer script. Follow the instructions below to properly modify the settings file according to your preferences.

## Configuration Options

### Config Dictionary

The `config` dictionary contains various settings that influence how the Renamer script operates. Here are the available configuration options:

- `wrapper_styles`: Wrapper style defines what brackets, if any, to use around each key value. Where available brackets are '{}', '[]', '()', or none.
- `separator`: Define the separator to use between different parts of the filename.
- `key_order`: Define the order of keys in the filename.
- `exclude_keys`: Specify keys to exclude from the formed filename.
- `move_files`: Define whether files should be moved when renaming.
- `rename_files`: Define whether files should be renamed when moved.
- `dry_run`: Define whether the script should run in dry run mode.
- `max_tag_keys`: Define the maximum number of tag keys to include in the filename.
- `tag_whitelist`: Define a whitelist of allowed tags.
- `exclude_paths`: Define paths to exclude from modifications.
- `tag_specific_paths`: Define a tag specific path to move a scene based on specific tags it contains.

### Wrapper Styles

Modify the values for each key under `wrapper_styles` to change how each part of the filename is wrapped. Use square brackets `[]`, curly brackets `{}`, parentheses `()`, or an empty string for None.

`Example: Studio-Title-Date.mp4 with a wrapper_styles of '[]' for each key --> [Studio]-[Title]-[Date].mp4`

### Separator

Modify the value of `separator` to specify the character used between different parts of the filename. Valid separators include hyphen `-`, underscore `_`, or space ` `.

### Key Order

Modify the `key_order` list to specify the order of keys in the filename. List the valid keys that can be included in the `key_order`.

### Exclude Keys

Modify the `exclude_keys` list to specify keys that should be excluded from the filename formation process.

### Move Files, Rename Files, and Dry Run

Modify the boolean values of `move_files`, `rename_files`, and `dry_run` to control the behavior of the script.

### Exclude Paths

Specify custom paths that you would like untouched by Renamer. 

# Rollback.py

This is an experimental script whereby it will target your `Renamer.json` external log. 

Run this script using `python Rollback.py` then supply it a scene ID that you would like to revert to its original location(s). When a scene ID is given, if it exists in the external `Renamer.json` log, it will indicate timestamps and original directories for that scene. Simply select an item `1. 2. 3. ...etc.` and the file will be renamed and moved back to its original directory. Think of this as a "snapshot" if there was ever a time you wanted to go back and change where a file should be moved or how it should be named.
