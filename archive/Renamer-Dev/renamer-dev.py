import requests
import shutil
from pathlib import Path
import stashapi.log as logger
from renamer_settings import config
import logging
import json
from pythonjsonlogger import jsonlogger
import re

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def format(self, record):
        # Create a JSON formatted string from the log record
        log_record = super().format(record)
        # Convert back to dict, then dump as compact JSON
        log_dict = json.loads(log_record)
        return json.dumps(log_dict)  # No indentation

def setup_external_logger():
    script_dir = Path(__file__).resolve().parent
    json_log_path = script_dir / "renamer.json"

    logger = logging.getLogger('ext_log')
    logger.setLevel(logging.INFO)

    log_handler = logging.FileHandler(json_log_path)
    formatter = CustomJsonFormatter('%(asctime)s %(levelname)s %(message)s')
    log_handler.setFormatter(formatter)

    logger.addHandler(log_handler)
    return logger

ext_log = setup_external_logger()

def graphql_request(query, variables=None):
    """Function to make GraphQL requests with authentication."""
    headers = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "ApiKey": config.get("api_key") 
    }
    response = requests.post(config['endpoint'], json={'query': query, 'variables': variables}, headers=headers)
    try:
        data = response.json()
        return data.get('data')
    except json.JSONDecodeError:
        logger.error(f"Failed to decode JSON from response: {response.text}")
        return None



def fetch_stash_directories():
    """Fetch the designated top level of each user's Stash directories."""
    configuration_query = """
        query Configuration {
            configuration {
                general {
                    stashes {
                        path
                    }
                }
            }
        }
    """
    result = graphql_request(configuration_query)
    return [Path(stash['path']) for stash in result['configuration']['general']['stashes']]

def replace_illegal_characters(filename):
    """Replace illegal characters in filenames."""
    illegal_chars = '<>:"/\\|?*'
    safe_chars = '-' * len(illegal_chars)
    transtable = str.maketrans(illegal_chars, safe_chars)
    return filename.translate(transtable)

def apply_regex_transformations(value, key):
    """ Apply regex transformations based on settings. """
    transformations = config.get('regex_transformations', {})
    for transformation_name, transformation_details in transformations.items():
        if key in transformation_details['fields']:
            pattern = re.compile(transformation_details['pattern'])
            # Corrected to pass the match object to the lambda function
            replacement_function = lambda match: transformation_details['replacement'](match)
            value = re.sub(pattern, replacement_function, value)
    return value

def sort_performers(performers):
    """Sort and limit the number of performers based on configuration."""
    sorted_performers = sorted(performers, key=lambda x: x['name'])  # Sort by name
    if config['performer_limit'] is not None and len(sorted_performers) > config['performer_limit']:
        sorted_performers = sorted_performers[:config['performer_limit']]
    return sorted_performers

def rename_associated_files(directory, filename_base, new_filename_base, dry_run):
    """Rename associated files in the same directory based on new base name."""
    for item in directory.iterdir():
        if item.suffix[1:] in config['associated_files'] and item.stem == filename_base:
            new_associated_file = directory / f"{new_filename_base}{item.suffix}"
            if dry_run:
                logger.info(f"Dry run: Would rename '{item}' to '{new_associated_file}'")
            else:
                item.rename(new_associated_file)
                logger.info(f"Renamed associated file '{item}' to '{new_associated_file}'")


def move_associated_files(directory, new_directory, dry_run):
    """Move associated files to a new directory specified by new_directory."""
    for item in directory.iterdir():
        if item.suffix[1:] in config['associated_files']:
            new_associated_file = new_directory / item.name
            if dry_run:
                logger.info(f"Dry run: Would move '{item}' to '{new_associated_file}'")
            else:
                shutil.move(str(item), str(new_associated_file))
                logger.info(f"Moved associated file '{item}' to '{new_associated_file}'")


def process_files(scene, new_filename, move, rename, dry_run):
    original_path = Path(scene['file_path'])
    new_path = calculate_new_path(original_path, new_filename)  # Calculates new path based on rules/logic
    directory = original_path.parent
    filename_base = original_path.stem
    new_filename_base = new_path.stem
    new_directory = new_path.parent

    if rename:
        rename_associated_files(directory, filename_base, new_filename_base, dry_run)

    # Handle main file operation
    if dry_run:
        logger.info(f"Dry run: Would {'move' if move else 'rename'} main file to '{new_path}'")
    else:
        if move:
            shutil.move(str(original_path), str(new_path))
            logger.info(f"Moved main file to '{new_path}'")
            # Move associated files after the main file has been moved
            move_associated_files(directory, new_directory, dry_run)
        elif rename:
            original_path.rename(new_path)
            logger.info(f"Renamed main file to '{new_path}'")

    if not move:
        # Move associated files separately if main file is not moved
        move_associated_files(directory, new_directory, dry_run)

import datetime

def apply_date_format(value):
    """Converts date strings from one format to another specified in the config."""
    try:
        # Convert from "%Y-%m-%d" to the specified format in config['date_format']
        formatted_date = datetime.datetime.strptime(value, "%Y-%m-%d").strftime(config['date_format'])
        return formatted_date
    except ValueError as e:
        ext_log.error(f"Date formatting error: {str(e)}")
        return value  # Return original value if there's a formatting error



def form_new_filename(scene):
    """Generate a new filename based on the scene attributes and settings."""
    parts = []
    for key in config['key_order']:
        if key in config['exclude_keys']:
            continue

        value = scene.get(key)
        if key == 'tags':
            filtered_tags = [tag['name'] for tag in value if tag['name'] in config['tag_whitelist']]
            value = config['separator'].join(filtered_tags) if filtered_tags else ''
        elif key == 'performers':
            performers = sort_performers(value)
            value = config['separator'].join(performer['name'] for performer in performers)
        elif key == 'date' and value:
            value = apply_date_format(value)
        elif key in ['studio', 'title']:
            value = value.get('name', '') if isinstance(value, dict) else value
        elif key in ['height', 'video_codec', 'frame_rate']:
            file_info_value = next((file_info.get(key) for file_info in scene.get('files', [])), '')
            if key == 'height' and file_info_value:
                value = str(file_info_value) + 'p'
            elif key == 'video_codec' and file_info_value:
                value = file_info_value.upper()
            elif key == 'frame_rate' and file_info_value:
                value = str(file_info_value) + ' FPS'

        value = apply_regex_transformations(value, key) if value else value
        part = f"{config['wrapper_styles'].get(key, ('', ''))[0]}{value}{config['wrapper_styles'].get(key, ('', ''))[1]}"
        part = replace_illegal_characters(part)
        parts.append(part)

    filename = config['separator'].join(parts).rstrip(config['separator'])
    logger.info(f"Generated filename: {filename}")
    return filename

def move_or_rename_files(scene, new_filename, move, rename, dry_run):
    if not scene:
        logger.error("No scene data provided to process.")
        return []

    scene_id = scene.get('id', 'Unknown')
    results = []

    if not scene.get('title'):
        logger.info(f"Skipping scene {scene_id} due to missing title.")
        return results

    studio = scene.get('studio', {})
    studio_name = studio.get('name')
    tags = {tag['name'] for tag in scene.get('tags', [])}
    tag_path = next((Path(config['tag_specific_paths'][tag]) for tag in tags if tag in config['tag_specific_paths']), None)

    for file_info in scene.get('files', []):
        original_path = Path(file_info['path'])
        current_stash = next((stash for stash in fetch_stash_directories() if original_path.is_relative_to(stash)), None)

        if not current_stash:
            if not dry_run:
                ext_log.error("File is not in any known stash path", extra={"file_path": str(original_path), "scene_id": scene_id})
            continue

        target_directory = tag_path / (studio_name if studio_name else 'Default') if tag_path else current_stash / (studio_name if studio_name else 'Default')
        new_path = target_directory / (new_filename + original_path.suffix)

        if dry_run:
            logger.info(f"Dry run: Would {'move' if move else 'rename'} file: {original_path} -> {new_path}")
            move_associated_files(original_path.parent, target_directory, dry_run)
            continue

        if not original_path.exists():
            ext_log.error("File not found", extra={"file_path": str(original_path), "scene_id": scene_id})
            continue

        target_directory.mkdir(parents=True, exist_ok=True)

        if move:
            shutil.move(str(original_path), str(new_path))
            action = "Moved"
            move_associated_files(original_path.parent, target_directory, dry_run)
        elif rename:
            original_path.rename(new_path)
            action = "Renamed"

        ext_log.info(f"{action} file", extra={"original_path": str(original_path), "new_path": str(new_path), "action_performed": action, "scene_id": scene_id})
        logger.info(f"{action} file from '{original_path}' to '{new_path}'.")
        results.append({"action": action, "original_path": str(original_path), "new_path": str(new_path), "scene_id": scene_id})

    return results


def rename_associated_files(original_path, new_path, dry_run=False):
    directory = original_path.parent
    base_name = original_path.stem
    new_base_name = new_path.stem

    for ext in config['associated_files']:
        associated_files = list(directory.glob(f"*.{ext}"))
        if len(associated_files) == 1 or any(file.stem == base_name for file in associated_files):
            for associated_file in associated_files:
                if associated_file.stem == base_name or len(associated_files) == 1:
                    new_associated_file = directory / f"{new_base_name}{associated_file.suffix}"
                    if dry_run:
                        logger.info(f"Dry run: Detected and would move/rename '{associated_file}' to '{new_associated_file}'")
                    else:
                        shutil.move(str(associated_file), str(new_associated_file))
                        logger.info(f"Moved and renamed associated file '{associated_file}' to '{new_associated_file}'")
                else:
                    logger.info(f"Associated file '{associated_file}' does not match base name '{base_name}' and will not be renamed.")
        else:
            logger.info(f"No unique or matching associated files found for extension '.{ext}' in directory '{directory}'")



def find_scene_by_id(scene_id):
    """Fetch detailed data for a specific scene by its ID."""
    query_find_scene = """
    query FindScene($scene_id: ID!) {
        findScene(id: $scene_id) {
            id
            title
            date
            files {
                path
                height
                video_codec
                frame_rate
            }
            studio {
                name
            }
            performers {
                name
            }
            tags {
                name
            }
        }
    }
    """
    scene_data = graphql_request(query_find_scene, variables={"scene_id": scene_id})
    return scene_data.get('findScene')

def main():
    """Main function to handle renaming and moving files."""
    query_all_scenes = """
        query AllScenes {
            allScenes {
                id
                updated_at
            }
        }
    """
    all_scenes_data = graphql_request(query_all_scenes)
    if not all_scenes_data or not all_scenes_data.get('allScenes'):
        logger.error("Failed to fetch scenes or no scenes found.")
        return
    latest_scene_id = max(all_scenes_data['allScenes'], key=lambda s: s['updated_at'])['id']
    detailed_scene = find_scene_by_id(latest_scene_id)
    if not detailed_scene:
        logger.error("Failed to fetch details for the latest scene.")
        return
    new_filename = form_new_filename(detailed_scene)
    move_or_rename_files(detailed_scene, new_filename, config['move_files'], config['rename_files'], config['dry_run'])

if __name__ == '__main__':
    main()
