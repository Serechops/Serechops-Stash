import os
import shutil
import requests
import json
import sys
import stashapi.log as log

def get_server_connection():
    try:
        json_input = json.loads(sys.stdin.read())
        server_connection = json_input.get('server_connection', {})
        log.debug(f"Server connection: {server_connection}")
        return server_connection
    except json.JSONDecodeError:
        log.error("Failed to decode JSON input.")
        return {}

def build_api_url(server_connection):
    scheme = server_connection.get('Scheme', 'http')
    host = server_connection.get('Host', 'localhost')
    port = server_connection.get('Port', 9999)
    session_cookie = server_connection.get('SessionCookie', {})
    api_key = session_cookie.get('Value', '')

    log.debug(f"Scheme: {scheme}")
    log.debug(f"Host: {host}")
    log.debug(f"Port: {port}")
    log.debug(f"API Key: {api_key}")

    if host == '0.0.0.0':
        log.info("Host is set to 0.0.0.0, changing it to 'localhost'.")
        host = 'localhost'

    api_url = f"{scheme}://{host}:{port}/graphql"
    return api_url, session_cookie.get('Name', ''), api_key

# Fetch server connection details
server_connection = get_server_connection()
api_url, cookie_name, api_key = build_api_url(server_connection)
if not api_url:
    raise Exception("Failed to build API URL. Exiting.")

# Set up the session with the API key
session = requests.Session()
if api_key:
    session.cookies.set(cookie_name, api_key)

# Configuration
CONFIG = {
    "PEOPLE_DIR": "C:\\ProgramData\\Jellyfin\\Server\\metadata\\People",
    "EXCLUDED_PATHS": [
        "E:\\Movies",
        "F:\\Movies 2",
        "D:\\Nubiles Porn",
        "E:\\movie-fy-testing"
    ],
    "DRY_RUN": True  # Set to True for a dry run
}

# GraphQL Queries
ALL_SCENES_QUERY = """
query AllScenes {
    allScenes {
        id
        title
        details
        date
        files {
            path
            duration
            basename
        }
        studio {
            name
        }
        performers {
            name
        }
        paths {
            screenshot
        }
        tags {
            name
        }
    }
}
"""

PERFORMER_QUERY = """
query FindPerformers($name: String!) {
    findPerformers(
        performer_filter: { name: { value: $name, modifier: EQUALS } }
        filter: { per_page: -1 }
    ) {
        performers {
            name
            image_path
        }
    }
}
"""

# Function to send GraphQL requests
def graphql_request(query, variables=None):
    response = session.post(api_url, json={'query': query, 'variables': variables})
    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as err:
        log.error(f"HTTP error occurred: {err}")
        log.error(f"Response: {response.text}")
        raise
    return response.json()

def download_file(url, path):
    if CONFIG['DRY_RUN']:
        log.info(f"[Dry Run] Would download file from {url} to {path}")
    else:
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()
            content_size = int(response.headers.get('Content-Length', 0))
            if content_size < 50 * 1024:  # Skip files smaller than 50KB
                log.info(f"Skipping download for {url} as it is smaller than 50KB")
                return False
            with open(path, 'wb') as file:
                for chunk in response.iter_content(8192):
                    file.write(chunk)
            log.info(f"Downloaded file: {path}")
            return True
        except requests.exceptions.RequestException as e:
            log.error(f"Failed to download file from {url} to {path}: {e}")
            return False

def create_directory(path):
    if CONFIG['DRY_RUN']:
        log.info(f"[Dry Run] Would create directory: {path}")
    else:
        if not os.path.exists(path):
            os.makedirs(path)
            log.info(f"Created directory: {path}")

def move_file(src, dest):
    if CONFIG['DRY_RUN']:
        log.info(f"[Dry Run] Would move file from {src} to {dest}")
    else:
        if not os.path.exists(src):
            log.error(f"Source file not found: {src}")
            return False
        try:
            shutil.move(src, dest)
            log.info(f"Moved file from {src} to {dest}")
            return True
        except Exception as e:
            log.error(f"Failed to move file from {src} to {dest}: {e}")
            return False

def convert_duration(seconds):
    seconds = int(float(seconds))
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)
    if hours > 0:
        return f"{hours:02}:{minutes:02}:{seconds:02}"
    else:
        return f"{minutes:02}:{seconds:02}"

def capitalize_name(name):
    return ' '.join(word.capitalize() for word in name.split())

def create_nfo_file(scene, directory):
    title = scene.get('title', 'Unknown Title')
    details = scene.get('details', 'No details available')
    duration = convert_duration(scene.get('files', [{}])[0].get('duration', 0))
    studio = scene.get('studio', {}).get('name', 'Unknown Studio') if scene.get('studio') else 'Unknown Studio'
    date = scene.get('date', 'Unknown Date')

    nfo_content = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<movie>
    <name>{title}</name>
    <plot>{details}</plot>
    <runtime>{duration}</runtime>
    <studio>{studio}</studio>
"""
    for performer in scene.get('performers', []):
        performer_name = capitalize_name(performer.get('name', 'Unknown Performer'))
        nfo_content += f"""
    <actor>
        <name>{performer_name}</name>
        <role>Performer</role>
    </actor>
"""
    nfo_content += f"""
    <year>{date}</year>
"""
    for tag in scene.get('tags', []):
        nfo_content += f"""
    <tag>{tag.get('name', 'Unknown Tag')}</tag>
"""
    nfo_content += """
</movie>
"""
    nfo_path = os.path.join(directory, 'movie.nfo')
    if CONFIG['DRY_RUN']:
        log.info(f"[Dry Run] Would create NFO file: {nfo_path}")
        log.info(f"[Dry Run] NFO content: {nfo_content}")
    else:
        try:
            with open(nfo_path, 'w', encoding='utf-8') as file:
                file.write(nfo_content)
                log.info(f"Created NFO file: {nfo_path}")
        except FileNotFoundError as e:
            log.error(f"Failed to create NFO file: {e}")

def is_excluded_path(path):
    path = os.path.abspath(path)
    for excluded_path in CONFIG['EXCLUDED_PATHS']:
        excluded_path = os.path.abspath(excluded_path)
        if path.startswith(excluded_path):
            return True
    return False

def check_and_download_images(current_directory, screenshot_url):
    screenshot_url += "/screenshot.jpg"
    poster_path = os.path.join(current_directory, 'poster.jpg')
    fanart_path = os.path.join(current_directory, 'fanart.jpg')

    # Check poster.jpg
    if not os.path.exists(poster_path) or os.path.getsize(poster_path) < 50 * 1024:
        log.info(f"poster.jpg is missing or smaller than 50KB in {current_directory}, attempting to re-download")
        if download_file(screenshot_url, poster_path):
            shutil.copy(poster_path, fanart_path)
        else:
            log.info(f"Skipping poster.jpg for {current_directory} due to download size being smaller than 50KB")

    # Check fanart.jpg
    if not os.path.exists(fanart_path) or os.path.getsize(fanart_path) < 50 * 1024:
        log.info(f"fanart.jpg is missing or smaller than 50KB in {current_directory}, attempting to re-download")
        if download_file(screenshot_url, fanart_path):
            shutil.copy(fanart_path, poster_path)
        else:
            log.info(f"Skipping fanart.jpg for {current_directory} due to download size being smaller than 50KB")

def process_performer(name):
    capitalized_name = capitalize_name(name)
    variables = {"name": capitalized_name}
    response = graphql_request(PERFORMER_QUERY, variables)
    performers = response['data'].get('findPerformers', {}).get('performers', [])
    if not performers:
        log.error(f"No performer found with name: {capitalized_name}")
        return

    performer_data = performers[0]
    first_letter = performer_data['name'][0].upper()
    performer_dir = os.path.join(CONFIG['PEOPLE_DIR'], first_letter, performer_data['name'])
    create_directory(performer_dir)

    performer_image_path = os.path.join(performer_dir, 'poster.jpg')
    if os.path.exists(performer_image_path):
        log.info(f"Performer image already exists: {performer_image_path}")
    else:
        image_url = performer_data.get('image_path', '')
        if image_url:
            download_file(image_url, performer_image_path)
        else:
            log.error(f"No image URL found for performer: {capitalized_name}")

def process_scenes(scenes):
    total_scenes = len(scenes)
    for index, scene in enumerate(scenes):
        files = scene.get('files', [])
        if not files:
            log.error(f"No files found for scene: {scene.get('title', 'Unknown Title')}")
            continue

        file_path = files[0].get('path', '')
        if not file_path:
            log.error(f"No file path found for scene: {scene.get('title', 'Unknown Title')}")
            continue

        if is_excluded_path(file_path):
            log.info(f"Skipping excluded path: {file_path}")
            continue

        current_directory = os.path.dirname(file_path)
        basename = files[0].get('basename', 'unknown')

        # Check if the scene is already in a directory named after the basename and if the image files are larger than 50KB
        poster_path = os.path.join(current_directory, 'poster.jpg')
        fanart_path = os.path.join(current_directory, 'fanart.jpg')
        if os.path.basename(current_directory) == os.path.splitext(basename)[0] and \
           os.path.exists(poster_path) and os.path.getsize(poster_path) >= 50 * 1024 and \
           os.path.exists(fanart_path) and os.path.getsize(fanart_path) >= 50 * 1024:
            log.info(f"Scene already in the proper directory: {current_directory} and images are larger than 50KB")
            continue

        # If the directory name matches but image size checks fail, re-download images
        if os.path.basename(current_directory) == os.path.splitext(basename)[0]:
            log.info(f"Scene is in the proper directory but images need to be re-downloaded: {current_directory}")
            screenshot_url = scene.get('paths', {}).get('screenshot')
            if screenshot_url:
                check_and_download_images(current_directory, screenshot_url)
            else:
                log.error(f"No screenshot URL found for scene: {scene.get('title', 'Unknown Title')}")
            continue

        # Otherwise, move the scene file and create the necessary directory structure
        new_directory = os.path.join(current_directory, os.path.splitext(basename)[0])
        create_directory(new_directory)
        new_file_path = os.path.join(new_directory, os.path.basename(file_path))
        if not move_file(file_path, new_file_path):
            log.error(f"Skipping file {file_path} due to an error while moving.")
            continue

        # Create NFO file
        create_nfo_file(scene, new_directory)

        # Download poster and fanart
        screenshot_url = scene.get('paths', {}).get('screenshot')
        if screenshot_url:
            check_and_download_images(new_directory, screenshot_url)
        else:
            log.error(f"No screenshot URL found for scene: {scene.get('title', 'Unknown Title')}")

        # Process performers
        for performer in scene.get('performers', []):
            process_performer(performer.get('name', 'Unknown Performer'))

        # Update progress
        progress = (index + 1) / total_scenes
        log.progress(progress)

def main():
    response = graphql_request(ALL_SCENES_QUERY)
    scenes = response['data'].get('allScenes', [])
    process_scenes(scenes)

if __name__ == "__main__":
    main()
