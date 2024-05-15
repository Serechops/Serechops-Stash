# renamer_settings.py
config = {
    "api_key": "",  # Your API key, if needed for the GraphQL endpoint
    "endpoint": "http://localhost:9999/graphql",  # GraphQL endpoint
    "log_path": "./renamer.log",  # Path to log file
    "default_move_path": r"C:\No Studio",  # Default path for moving files
    "wrapper_styles": {
        "studio": ('{', '}'),
        "title": ('(', ')'),
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
    "exclude_keys": ["height", "frame_rate"],  # Keys to exclude from filename formation
    "move_files": True,  # Enable moving of files
    "rename_files": True,  # Enable renaming of files
    "dry_run": False,  # Dry run mode
    "max_tag_keys": 5,  # Maximum number of tag keys in filename
    "tag_whitelist": [],  # List of tags to include in filename
    "exclude_paths": [],  # Paths to exclude from processing
    "tag_specific_paths": {
        "Movie": r"E:\Movies"      # Specific paths based on tags
    },
    "regex_transformations": {
        "all_uppercase": {  # Transforms text to uppercase
            "fields": ["performers"],  # Specify fields to transform
            "pattern": ".*",  # Match any text
            "replacement": lambda match: match.group().upper() # Transform to uppercase
        },
        "all_lowercase": {  # Transforms text to lowercase
            "fields": ["tags"],  # Specify fields to transform
            "pattern": ".*",  # Match any text
            "replacement": lambda match: match.group().lower()  # Transform to lowercase
        }
    },
    "associated_files": ["srt", "vtt", "jpg", "png"],  # File extensions of associated files to rename
    "performer_sort": "name",  # Sort performers by name
    "performer_limit": 3,  # Limit number of performers listed in filename
    "date_format": "%Y-%m-%d"  # Date format in filenames
}
