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
