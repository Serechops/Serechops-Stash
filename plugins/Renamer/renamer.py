import requests
import os
import logging
import shutil
from pathlib import Path
import hashlib

# Importing stashapi.log as log for critical events
import stashapi.log as log

# Import settings from renamer_settings.py
from renamer_settings import config

# Get the directory of the script
script_dir = Path(__file__).resolve().parent

# Configure logging for your script
log_file_path = script_dir / 'renamer.log'
logging.basicConfig(filename=log_file_path, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('renamer')

# GraphQL endpoint
endpoint = 'http://localhost:9999/graphql'  # Update with your endpoint

# GraphQL query to fetch all scenes
query_all_scenes = """
    query AllScenes {
        allScenes {
            id
            updated_at
        }
    }
"""

# Function to make GraphQL requests
def graphql_request(query, variables=None):
    data = {'query': query}
    if variables:
        data['variables'] = variables
    response = requests.post(endpoint, json=data)
    return response.json()

# Function to replace illegal characters in filenames
def replace_illegal_characters(filename):
    illegal_characters = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
    for char in illegal_characters:
        filename = filename.replace(char, '-')
    return filename

def should_exclude_path(scene_details, exclude_paths):
    scene_path = scene_details['files'][0]['path']  # Assuming the first file path is representative
    for exclude_path in exclude_paths:
        if scene_path.startswith(exclude_path):
            return True
    return False

# Function to form the new filename based on scene details and user settings
def form_filename(scene_details, wrapper_styles, separator, key_order, exclude_keys, max_tag_keys=None, tag_whitelist=None, dry_run=None, exclude_paths=None):  
    filename_parts = []
    tag_keys_added = 0
    
    # Function to add tag to filename
    def add_tag(tag_name):
        nonlocal tag_keys_added
        if max_tag_keys is not None and tag_keys_added >= int(max_tag_keys):
            return  # Skip adding more tags if the maximum limit is reached
        
        # Check if the tag name is in the whitelist
        if tag_whitelist and tag_name in tag_whitelist:
            if wrapper_styles.get('tag'):
                filename_parts.append(f"{wrapper_styles['tag'][0]}{tag_name}{wrapper_styles['tag'][1]}")
            else:
                filename_parts.append(tag_name)
            tag_keys_added += 1
        else:
            if not dry_run:
                log.info(f"Skipping tag not in whitelist: {tag_name}")
                logger.info(f"Skipping tag not in whitelist: {tag_name}")
    
    for key in key_order:
        if not exclude_keys or key not in exclude_keys:
            if key == 'studio':
                studio_name = scene_details.get('studio', {}).get('name', '')
                if studio_name:
                    if wrapper_styles.get('studio'):
                        filename_parts.append(f"{wrapper_styles['studio'][0]}{studio_name}{wrapper_styles['studio'][1]}")
                    else:
                        filename_parts.append(studio_name)
            elif key == 'title':
                title = scene_details.get('title', '')
                if title:
                    if wrapper_styles.get('title'):
                        filename_parts.append(f"{wrapper_styles['title'][0]}{title}{wrapper_styles['title'][1]}")
                    else:
                        filename_parts.append(title)
            elif key == 'performers':
                performers = '-'.join([performer.get('name', '') for performer in scene_details.get('performers', [])])
                if performers:
                    if wrapper_styles.get('performers'):
                        filename_parts.append(f"{wrapper_styles['performers'][0]}{performers}{wrapper_styles['performers'][1]}")
                    else:
                        filename_parts.append(performers)
            elif key == 'date':
                scene_date = scene_details.get('date', '')
                if scene_date:
                    if wrapper_styles.get('date'):
                        filename_parts.append(f"{wrapper_styles['date'][0]}{scene_date}{wrapper_styles['date'][1]}")
                    else:
                        filename_parts.append(scene_date)
            elif key == 'height':
                height = str(scene_details.get('files', [{}])[0].get('height', ''))  # Convert height to string
                if height:
                    height += 'p'
                    if wrapper_styles.get('height'):
                        filename_parts.append(f"{wrapper_styles['height'][0]}{height}{wrapper_styles['height'][1]}")
                    else:
                        filename_parts.append(height)
            elif key == 'video_codec':
                video_codec = scene_details.get('files', [{}])[0].get('video_codec', '').upper()  # Convert to uppercase
                if video_codec:
                    if wrapper_styles.get('video_codec'):
                        filename_parts.append(f"{wrapper_styles['video_codec'][0]}{video_codec}{wrapper_styles['video_codec'][1]}")
                    else:
                        filename_parts.append(video_codec)
            elif key == 'frame_rate':
                frame_rate = str(scene_details.get('files', [{}])[0].get('frame_rate', '')) + ' FPS'  # Convert to string and append ' FPS'
                if frame_rate:
                    if wrapper_styles.get('frame_rate'):
                        filename_parts.append(f"{wrapper_styles['frame_rate'][0]}{frame_rate}{wrapper_styles['frame_rate'][1]}")
                    else:
                        filename_parts.append(frame_rate)
            elif key == 'tags':
                tags = [tag.get('name', '') for tag in scene_details.get('tags', [])]
                for tag_name in tags:
                    add_tag(tag_name)
    
    new_filename = separator.join(filename_parts).replace('--', '-')

    # Check if the scene's path matches any of the excluded paths
    if exclude_paths and should_exclude_path(scene_details, exclude_paths):
        log.info(f"Scene belongs to an excluded path. Skipping filename modification.")
        return Path(scene_details['files'][0]['path']).name  # Return the original filename

    return replace_illegal_characters(new_filename)

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
    scene_result = graphql_request(query_find_scene, variables={"scene_id": scene_id})
    return scene_result.get('data', {}).get('findScene')

def move_or_rename_files(scene_details, new_filename, original_parent_directory, move_files, rename_files, dry_run, exclude_paths=None):
    studio_directory = None
    for file_info in scene_details['files']:
        path = file_info['path']
        original_path = Path(path)

        # Check if the file's path matches any of the excluded paths
        if exclude_paths and any(original_path.match(exclude_path) for exclude_path in exclude_paths):
            log.info(f"File {path} belongs to an excluded path. Skipping modification.")
            continue

        new_path = original_parent_directory if not move_files else original_parent_directory / scene_details['studio']['name']
        if rename_files:
            new_path = new_path / (new_filename + original_path.suffix)
        try:
            if move_files:
                if studio_directory is None:
                    studio_directory = original_parent_directory / scene_details['studio']['name']
                    studio_directory.mkdir(parents=True, exist_ok=True)
                if rename_files and not dry_run:  # Check if rename_files is True and dry_run is False
                    shutil.move(original_path, new_path)
                    log.info(f"Moved and renamed file: {path} -> {new_path}")
                    logger.info(f"Moved and renamed file: {path} -> {new_path}")
                elif not dry_run:  # Check if dry_run is False
                    shutil.move(original_path, new_path)
                    log.info(f"Moved file: {path} -> {new_path}")
                    logger.info(f"Moved file: {path} -> {new_path}")
                else:  # If dry_run is True
                    log.info(f"Dry run: Would have moved file: {path} -> {new_path}")
                    logger.info(f"Dry run: Would have moved file: {path} -> {new_path}")
            else:
                if rename_files and not dry_run:  # Check if rename_files is True and dry_run is False
                    original_path.rename(new_path)
                    log.info(f"Renamed file: {path} -> {new_path}")
                    logger.info(f"Renamed file: {path} -> {new_path}")
                elif not dry_run:  # Check if dry_run is False
                    shutil.move(original_path, new_path)
                    log.info(f"Moved file: {path} -> {new_path}")
                    logger.info(f"Moved file: {path} -> {new_path}")
                else:  # If dry_run is True
                    log.info(f"Dry run: Would have renamed file: {path} -> {new_path}")
                    logger.info(f"Dry run: Would have renamed file: {path} -> {new_path}")
        except FileNotFoundError:
            log.error(f"File not found: {path}. Skipping...")
            continue
        except OSError as e:
            log.error(f"Failed to move or rename file: {path}. Error: {e}")
            continue

    return new_path  # Return the new_path variable after the loop

def perform_metadata_scan(metadata_scan_path):
    metadata_scan_path_windows = metadata_scan_path.resolve().as_posix()
    mutation_metadata_scan = """
        mutation {
            metadataScan(input: { paths: "%s" })
        }
    """ % metadata_scan_path_windows
    logger.info(f"Attempting metadata scan mutation with path: {metadata_scan_path_windows}")
    logger.info(f"Mutation string: {mutation_metadata_scan}")
    graphql_request(mutation_metadata_scan)

def rename_scene(scene_id, wrapper_styles, separator, key_order, stash_directory, rename_files, move_files, dry_run, max_tag_keys=None, tag_whitelist=None, exclude_paths=None):  
    scene_details = find_scene_by_id(scene_id)
    if not scene_details:
        log.error(f"Scene with ID {scene_id} not found.")
        return

    exclude_keys = config["exclude_keys"]

    original_file_path = scene_details['files'][0]['path']
    original_parent_directory = Path(original_file_path).parent

    # Check if the scene's path matches any of the excluded paths
    if exclude_paths and any(Path(original_file_path).match(exclude_path) for exclude_path in exclude_paths):
        log.info(f"Scene with ID {scene_id} belongs to an excluded path. Skipping modifications.")
        return

    original_path_info = {'original_file_path': original_file_path,
                         'original_parent_directory': original_parent_directory}

    new_path_info = None

    new_filename = form_filename(scene_details, wrapper_styles, separator, key_order, exclude_keys, max_tag_keys=max_tag_keys, tag_whitelist=tag_whitelist, dry_run=dry_run, exclude_paths=exclude_paths)  

    if dry_run:
        log.info("Dry run mode is enabled.")
        logger.info("Dry run mode is enabled.")

    if rename_files:
        new_path = original_parent_directory / (new_filename + Path(original_file_path).suffix)
        new_path_info = {'new_file_path': new_path}
        if dry_run:  
            log.info(f"Dry run: Filename would be: {new_path}")
            logger.info(f"Dry run: Filename would be: {new_path}")
        else:
            log.info(f"New filename: {new_path}")
            logger.info(f"New filename: {new_path}")

    if move_files and original_parent_directory.name != scene_details['studio']['name']:
        new_path = original_parent_directory / scene_details['studio']['name'] / (new_filename + Path(original_file_path).suffix)
        new_path_info = {'new_file_path': new_path}
        if dry_run:  
            log.info(f"Dry run: File would be moved to directory: {new_path}")
            logger.info(f"Dry run: File would be moved to directory: {new_path}")
        else:
            move_or_rename_files(scene_details, new_filename, original_parent_directory, move_files, rename_files, dry_run)

    # If rename_files is True, attempt renaming even if move_files is False
    if rename_files:
        original_file_name = Path(original_file_path).name
        new_file_path = original_parent_directory / (new_filename + Path(original_file_name).suffix)
        if original_file_name != new_filename:
            try:
                if not dry_run:
                    os.rename(original_file_path, new_file_path)
                    log.info(f"Renamed file: {original_file_path} -> {new_file_path}")
                    logger.info(f"Renamed file: {original_file_path} -> {new_file_path}")
                else:
                    log.info(f"Dry run: Would have renamed file: {original_file_path} -> {new_file_path}")
                    logger.info(f"Dry run: Would have renamed file: {original_file_path} -> {new_file_path}")
            except Exception as e:
                log.error(f"Failed to rename file: {original_file_path}. Error: {e}")

    metadata_scan_path = original_parent_directory
    perform_metadata_scan(metadata_scan_path)

    max_filename_length = 256
    if len(new_filename) > max_filename_length:
        extension_length = len(Path(original_file_path).suffix)
        max_base_filename_length = max_filename_length - extension_length
        truncated_filename = new_filename[:max_base_filename_length]
        hash_suffix = hashlib.md5(new_filename.encode()).hexdigest()
        new_filename = truncated_filename + '_' + hash_suffix + Path(original_file_path).suffix

    return new_filename, original_path_info, new_path_info 
    

# Execute the GraphQL query to fetch all scenes
scene_result = graphql_request(query_all_scenes)
all_scenes = scene_result.get('data', {}).get('allScenes', [])
if not all_scenes:
    log.error("No scenes found.")
    exit()

# Find the scene with the latest updated_at timestamp
latest_scene = max(all_scenes, key=lambda scene: scene['updated_at'])

# Extract the ID of the latest scene
latest_scene_id = latest_scene.get('id')

# Extract dry_run setting from settings
dry_run_setting = config["dry_run"]

# Extract wrapper styles, separator, and key order from settings
wrapper_styles = config["wrapper_styles"]
separator = config["separator"]
key_order = config["key_order"]

# Read stash directory from renamer_settings.py
stash_directory = config.get('stash_directory', '')

# Extract rename_files and move_files settings from renamer_settings.py
rename_files_setting = config["rename_files"]
move_files_setting = config["move_files"]

# Extract tag whitelist from settings
tag_whitelist = config.get("tag_whitelist")

# Rename the latest scene and trigger metadata scan
new_filename = rename_scene(latest_scene_id, wrapper_styles, separator, key_order, stash_directory, rename_files_setting, move_files_setting, dry_run_setting, max_tag_keys=config["max_tag_keys"], tag_whitelist=tag_whitelist, exclude_paths=config.get("exclude_paths"))

# Log dry run state and indicate if no changes were made
if dry_run_setting:  
    log.info("Dry run: Script executed in dry run mode. No changes were made.")
    logger.info("Dry run: Script executed in dry run mode. No changes were made.")
elif not new_filename:  
    log.info("No changes were made.")
    logger.info("No changes were made.")
