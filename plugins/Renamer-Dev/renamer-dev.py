import requests
import shutil
from pathlib import Path
import stashapi.log as logger
from renamer_settings import config
import logging
import json
from pythonjsonlogger import jsonlogger

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

def form_new_filename(scene):
    """Generate a new filename based on the scene attributes and settings, ensuring correct data extraction and formatting."""
    parts = []
    for key in config['key_order']:
        if key in config['exclude_keys']:
            continue
        
        value = scene.get(key)
        if key == 'tags':
            # Process tags with whitelist filtering
            filtered_tags = [tag['name'] for tag in value if tag['name'] in config['tag_whitelist']]
            if not filtered_tags:
                continue
            value = config['separator'].join(filtered_tags)
        elif key == 'performers':
            # Extract names from performer dictionaries
            value = config['separator'].join(performer['name'] for performer in value if 'name' in performer)
        elif key in ['studio', 'title', 'date']:
            # Direct extraction for single-level dictionary keys or plain keys
            if isinstance(value, dict):
                value = value.get('name')
        elif key in ['height', 'video_codec', 'frame_rate']:
            # Special formatting rules
            value = next((file_info.get(key) for file_info in scene.get('files', [])), '')
            if key == 'height':
                value = f"{value}p"
            elif key == 'video_codec':
                value = value.upper()
            elif key == 'frame_rate':
                value = f"{value} FPS"
        
        if not value:
            continue  # Skip empty values

        # Apply wrapper styles and replace illegal characters
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

    # Determine specific paths based on tags
    tag_path = None
    for tag in tags:
        if tag in config['tag_specific_paths']:
            tag_path = Path(config['tag_specific_paths'][tag])
            logger.info(f"Detected tag directory for scene {scene_id}: Tag '{tag}' maps to directory '{tag_path}'")
            break

    for file_info in scene.get('files', []):
        original_path = Path(file_info['path'])
        current_stash = next((stash for stash in fetch_stash_directories() if original_path.is_relative_to(stash)), None)

        if not current_stash:
            if not dry_run:
                ext_log.error("File is not in any known stash path", extra={"file_path": str(original_path), "scene_id": scene_id})
            continue

        if move and (studio_name or tag_path):
            # Ensure directory creation is correctly handled within tag-specific paths
            target_directory = tag_path / (studio_name if studio_name else 'Default') if tag_path else current_stash / (studio_name if studio_name else 'Default')
        else:
            target_directory = original_path.parent

        new_path = target_directory / (new_filename + original_path.suffix)

        if dry_run:
            logger.info(f"Dry run: Would {'move' if move and studio_name else 'rename'} file: {original_path} -> {new_path}")
            continue

        if not original_path.exists():
            ext_log.error("File not found", extra={"file_path": str(original_path), "scene_id": scene_id})
            continue

        target_directory.mkdir(parents=True, exist_ok=True)
        if move and (studio_name or tag_path):
            shutil.move(str(original_path), str(new_path))
            action = "Moved"
        elif rename:
            original_path.rename(new_path)
            action = "Renamed"
        else:
            continue

        ext_log.info(f"{action} file", extra={
            "original_path": str(original_path),
            "new_path": str(new_path),
            "action_performed": action,
            "scene_id": scene_id
        })

        logger.info(f"{action} file from '{original_path}' to '{new_path}'.")
        results.append({
            "action": action,
            "original_path": str(original_path),
            "new_path": str(new_path),
            "scene_id": scene_id
        })

    return results

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
