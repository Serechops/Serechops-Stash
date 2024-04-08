# Renamer:

### Requirements

`pip install stashapp-tools`
`pip install pyYAML`

### Using Renamer 
`*Note: All changes are made when a Scene is updated and saved. Start small, make sure you get the changes you want in place first, then Rename away!`

When you have installed the `Renamer` plugin, hop into your plugins directory, Renamer folder > open renamer_settings.py with your favorite code/text editor and you'll see this:

```
# Importing config dictionary
config = {
    # Define wrapper styles for different parts of the filename.
    # Use '[]' for square brackets, '{}' for curly brackets, '()' for parentheses, or an empty string for None.
    "wrapper_styles": {
        "studio": '[]',        # Modify these values to change how each part of the filename is wrapped.
        "title": '[]',         # Use '[]' for square brackets, '{}' for curly brackets, '()' for parentheses, or an empty string for None.    
        "performers": '[]',    # Example: Studio-Title-Performers-Date.extension --> 
        "date": '[]',          # The default wrapper_styles are all '[]' so will wrap each portion of the filename in '[]'
        "height": '[]',        # Thus, your default title will look something like this: [Studio]-[Title]-[Performers]-[Date].extension 
        "video_codec": '[]',   
        "frame_rate": '[]',    
        "tag": '[]'            
    },
    # Define the separator to use between different parts of the filename.
    # Use '-' for hyphen, '_' for underscore, or ' ' for space.
    "separator": '-',  
    # Define the order of keys in the filename.
    # Use a list to specify the order of keys.
    # Valid keys are 'studio', 'title', 'performers', 'date', 'height', 'video_codec', 'frame_rate', and 'tags'.
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
    # Define keys to exclude from the formed filename
    # Specify keys to exclude from the filename formation process. (ie. "exclude_keys": ["studio", "date"],)
    "exclude_keys": [],
    # Define whether files should be moved when renaming
    "move_files": False,
    # Define whether files should be renamed when moved
    "rename_files": True,
    # Define whether the script should run in dry run mode
    "dry_run": True,
    # Define the maximum number of tag keys to include in the filename (None for no limit)
    "max_tag_keys": 10,
    # Define a whitelist of allowed tags (None to disallow all tags)
    "tag_whitelist": ["Creampie"],   #Example: "tag_whitelist": ["tag1", "tag2", "tag3"]
    # Define paths to exclude from modifications
    "exclude_paths": []     #Example: "exclude_paths": [r"/path/to/exclude1"]
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

## Example Configuration

```python
config = {
    "wrapper_styles": {
        "studio": '[]',
        "title": '[]',
        "performers": '[]',
        "date": '[]',
        "height": '[]',
        "video_codec": '[]',
        "frame_rate": '[]',
        "tag": '[]'
    },
    "separator": '-',
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
    "exclude_keys": [],
    "move_files": False,
    "rename_files": True,
    "dry_run": True,
    "max_tag_keys": 10,
    "tag_whitelist": ["Boots"],
    "exclude_paths": [r"/path/to/exclude1"]
}
```
