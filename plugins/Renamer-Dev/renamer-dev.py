import requests
import shutil
from pathlib import Path
import stashapi.log as logger
from renamer_settings import config
import logging
import json
from pythonjsonlogger import jsonlogger
import re
import sys
import os

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def format(self, record):
        log_record = super().format(record)
        log_dict = json.loads(log_record)
        return json.dumps(log_dict)

def setup_external_logger():
    script_directory = os.path.dirname(os.path.abspath(__file__))
    log_path = os.path.join(script_directory, 'renamer.json')
    logger = logging.getLogger('ext_log')
    logger.setLevel(logging.INFO)

    log_handler = logging.FileHandler(log_path)
    formatter = CustomJsonFormatter('%(asctime)s %(levelname)s %(message)s')
    log_handler.setFormatter(formatter)

    logger.addHandler(log_handler)
    return logger

ext_log = setup_external_logger()


def graphql_request(query, variables=None):
    headers = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "ApiKey": config.get("api_key", "") 
    }
    response = requests.post(config['endpoint'], json={'query': query, 'variables': variables}, headers=headers)
    try:
        data = response.json()
        return data.get('data')
    except json.JSONDecodeError:
        logger.error(f"Failed to decode JSON from response: {response.text}")
        return None

def fetch_stash_directories():
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
    illegal_chars = '<>:"/\\|?*'
    safe_chars = '-' * len(illegal_chars)
    transtable = str.maketrans(illegal_chars, safe_chars)
    return filename.translate(transtable) if isinstance(filename, str) else filename

def apply_regex_transformations(value, key):
    transformations = config.get('regex_transformations', {})
    for transformation_name, transformation_details in transformations.items():
        if key in transformation_details['fields']:
            pattern = re.compile(transformation_details['pattern'])
            replacement_function = lambda match: transformation_details['replacement'](match)
            value = re.sub(pattern, replacement_function, value)
    return value

def apply_studio_template(studio_name, scene_data):
    templates = config.get("studio_templates", {})
    template = templates.get(studio_name, "")
    
    if not template:
        return None
    
    # Prepare template data with transformations and limits
    template_data = {}
    for key, value in scene_data.items():
        if isinstance(value, dict) and 'name' in value:
            value = value['name']
        if key == 'performers':
            value = sort_performers(value)
            value = config['separator'].join(performer['name'] for performer in value)
        if key == 'tags':
            filtered_tags = [tag['name'] for tag in value if tag['name'] in config['tag_whitelist']]
            value = config['separator'].join(filtered_tags) if filtered_tags else ''
        if key == 'date' and value:
            value = apply_date_format(value)
        value = apply_regex_transformations(value, key) if isinstance(value, str) else value
        value = replace_illegal_characters(value) if isinstance(value, str) else value
        template_data[key] = value

    filename = template
    for key, value in template_data.items():
        wrapper = config['wrapper_styles'].get(key, ('', ''))
        filename = filename.replace(f"${key}", f"{wrapper[0]}{value}{wrapper[1]}")
    
    logger.info(f"Applying studio template for '{studio_name}': {filename}")
    return filename

def sort_performers(performers):
    sorted_performers = sorted(performers, key=lambda x: x['name'])
    if config['performer_limit'] is not None and len(sorted_performers) > config['performer_limit']:
        sorted_performers = sorted_performers[:config['performer_limit']]
    return sorted_performers

def rename_associated_files(directory, filename_base, new_filename_base, dry_run=False, scene_id=None):
    for ext in config['associated_files']:
        associated_files = list(directory.glob(f"{filename_base}*.{ext}"))
        if len(associated_files) == 1 or any(file.stem.startswith(filename_base) for file in associated_files):
            for associated_file in associated_files:
                if associated_file.stem.startswith(filename_base) or len(associated_files) == 1:
                    new_associated_file = directory / f"{new_filename_base}{associated_file.suffix}"
                    if dry_run:
                        logger.info(f"Dry run: Detected and would move/rename '{associated_file}' to '{new_associated_file}'")
                    else:
                        shutil.move(str(associated_file), str(new_associated_file))
                        logger.info(f"Moved and renamed associated file '{associated_file}' to '{new_associated_file}'")
                        if scene_id:
                            ext_log.info(f"Moved and renamed associated file", extra={"original_path": str(associated_file), "new_path": str(new_associated_file), "scene_id": scene_id})
                else:
                    logger.info(f"Associated file '{associated_file}' does not match base name '{filename_base}' and will not be renamed.")
        else:
            logger.info(f"No unique or matching associated files found for extension '.{ext}' in directory '{directory}'")

def move_associated_files(directory, new_directory, filename_base, dry_run, scene_id=None):
    for item in directory.iterdir():
        if item.suffix[1:] in config['associated_files']:
            new_associated_file = new_directory / item.name
            if dry_run:
                logger.info(f"Dry run: Would move '{item}' to '{new_associated_file}'")
            else:
                shutil.move(str(item), str(new_associated_file))
                logger.info(f"Moved associated file '{item}' to '{new_associated_file}'")
                if scene_id:
                    ext_log.info(f"Moved associated file", extra={"original_path": str(item), "new_path": str(new_associated_file), "scene_id": scene_id})

def process_files(scene, new_filename, move, rename, dry_run):
    original_path = Path(scene['file_path'])
    new_path = calculate_new_path(original_path, new_filename)
    directory = original_path.parent
    filename_base = original_path.stem
    new_filename_base = new_path.stem
    new_directory = new_path.parent

    # Check if the file is already in the target directory
    if original_path.parent == new_path.parent:
        if dry_run:
            logger.info(f"Dry run: File '{original_path}' is already in the correct directory.")
        else:
            logger.info(f"File '{original_path}' is already in the correct directory.")
        move = False

    # Check if the filename already matches the new filename
    if original_path.name == new_path.name:
        if dry_run:
            logger.info(f"Dry run: File '{original_path}' already has the correct filename.")
        else:
            logger.info(f"File '{original_path}' already has the correct filename.")
        rename = False

    if rename:
        rename_associated_files(directory, filename_base, new_filename_base, dry_run)

    if dry_run:
        logger.info(f"Dry run: Would {'move' if move else 'rename'} main file to '{new_path}'")
    else:
        if move:
            shutil.move(str(original_path), str(new_path))
            logger.info(f"Moved main file to '{new_path}'")
            ext_log.info(f"Moved main file", extra={"original_path": str(original_path), "new_path": str(new_path)})
            move_associated_files(directory, new_directory, filename_base, dry_run)
        elif rename:
            original_path.rename(new_path)
            logger.info(f"Renamed main file to '{new_path}'")
            ext_log.info(f"Renamed main file", extra={"original_path": str(original_path), "new_path": str(new_path)})

    if not move:
        move_associated_files(directory, new_directory, filename_base, dry_run)

import datetime

def apply_date_format(value):
    try:
        formatted_date = datetime.datetime.strptime(value, "%Y-%m-%d").strftime(config['date_format'])
        return formatted_date
    except ValueError as e:
        ext_log.error(f"Date formatting error: {str(e)}")
        return value

def form_new_filename(scene):
    studio = scene.get('studio', None)
    studio_name = studio.get('name', '') if studio else None
    templated_filename = apply_studio_template(studio_name, scene)
    
    if templated_filename:
        logger.info(f"Studio template detected for '{studio_name}' and applied: {templated_filename}")
        return templated_filename
    
    parts = []
    for key in config['key_order']:
        if key in config['exclude_keys']:
            continue

        value = scene.get(key)
        if key == 'studio' and not studio:
            continue  # Skip studio if it's None
        if isinstance(value, dict) and 'name' in value:
            value = value['name']
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

        if value:  # Skip empty values
            value = apply_regex_transformations(value, key) if isinstance(value, str) else value
            value = replace_illegal_characters(value) if isinstance(value, str) else value
            wrapper = config['wrapper_styles'].get(key, ('', ''))
            part = f"{wrapper[0]}{value}{wrapper[1]}"
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

    studio = scene.get('studio', None)
    studio_name = studio.get('name', 'No Studio') if studio else 'No Studio'
    tags = {tag['name'] for tag in scene.get('tags', [])}
    tag_path = next((Path(config['tag_specific_paths'][tag]) for tag in tags if tag in config['tag_specific_paths']), None)

    for file_info in scene.get('files', []):
        original_path = Path(file_info['path'])
        current_stash = next((stash for stash in fetch_stash_directories() if original_path.is_relative_to(stash)), None)

        if not current_stash:
            if not dry_run:
                ext_log.error("File is not in any known stash path", extra={"file_path": str(original_path), "scene_id": scene_id})
            continue

        if move:
            target_directory = tag_path / studio_name if tag_path else current_stash / studio_name
            new_path = target_directory / (new_filename + original_path.suffix)

            if original_path.parent == new_path.parent:
                if dry_run:
                    logger.info(f"Dry run: File '{original_path}' is already in the correct directory.")
                else:
                    logger.info(f"File '{original_path}' is already in the correct directory.")
                move = False

            if original_path.name == new_path.name:
                if dry_run:
                    logger.info(f"Dry run: File '{original_path}' already has the correct filename.")
                else:
                    logger.info(f"File '{original_path}' already has the correct filename.")
                rename = False

            if dry_run:
                logger.info(f"Dry run: Would {'move' if move else 'rename'} file: {original_path} -> {new_path}")
                move_associated_files(original_path.parent, target_directory, original_path.stem, dry_run, scene_id)
                continue

            if not original_path.exists():
                ext_log.error("File not found", extra={"file_path": str(original_path), "scene_id": scene_id})
                continue

            target_directory.mkdir(parents=True, exist_ok=True)

            if move:
                shutil.move(str(original_path), str(new_path))
                action = "Moved"
                if scene_id != 'Unknown':
                    ext_log.info(f"Moved main file", extra={"original_path": str(original_path), "new_path": str(new_path), "scene_id": scene_id})
                move_associated_files(original_path.parent, target_directory, original_path.stem, dry_run, scene_id)
            elif rename:
                original_path.rename(new_path)
                action = "Renamed"
                if scene_id != 'Unknown':
                    ext_log.info(f"Renamed main file", extra={"original_path": str(original_path), "new_path": str(new_path), "scene_id": scene_id})

            logger.info(f"{action} file from '{original_path}' to '{new_path}'.")
            results.append({"action": action, "original_path": str(original_path), "new_path": str(new_path), "scene_id": scene_id})

        if rename and not move:
            new_path = original_path.parent / (new_filename + original_path.suffix)

            if original_path.name != new_path.name:
                if dry_run:
                    logger.info(f"Dry run: Would rename main file from '{original_path}' to '{new_path}'")
                else:
                    original_path.rename(new_path)
                    logger.info(f"Renamed main file from '{original_path}' to '{new_path}'")
                    if scene_id != 'Unknown':
                        ext_log.info(f"Renamed main file", extra={"original_path": str(original_path), "new_path": str(new_path), "scene_id": scene_id})
                rename_associated_files(original_path.parent, original_path.stem, new_path.stem, dry_run, scene_id)
            else:
                logger.info(f"File '{original_path}' already has the correct filename.")

    return results



def find_scene_by_id(scene_id):
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

def get_hook_context():
    try:
        json_input = json.loads(sys.stdin.read())
        hook_context = json_input.get('args', {}).get('hookContext', {})
        return hook_context
    except json.JSONDecodeError:
        logger.error("Failed to decode JSON input.")
        return {}

def main():
    hook_context = get_hook_context()
    if not hook_context:
        logger.error("No hook context provided.")
        return

    scene_id = hook_context.get('id')
    if not scene_id:
        logger.error("No scene ID provided in the hook context.")
        return

    detailed_scene = find_scene_by_id(scene_id)
    if not detailed_scene:
        logger.error(f"Failed to fetch details for scene ID: {scene_id}")
        return

    new_filename = form_new_filename(detailed_scene)
    move_or_rename_files(detailed_scene, new_filename, config['move_files'], config['rename_files'], config['dry_run'])

if __name__ == '__main__':
    main()
