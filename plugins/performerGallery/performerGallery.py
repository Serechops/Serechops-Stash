import json
import os
import re
import requests
import shutil
import sys
from stashapi.stashapp import StashInterface
import stashapi.log as log

# Constants
PER_PAGE = 25
DEFAULT_GRAPHQL_URL = "http://localhost:9999/graphql"

# Get current directory
full_path = os.path.realpath(__file__)
default_dlpath = os.path.dirname(full_path)

s = requests.Session()

def get_stash_connection_info():
    """
    Retrieves Stash connection details.
    """
    try:
        # Parse connection details from stdin
        json_input = json.loads(sys.stdin.read())
        FRAGMENT_SERVER = json_input.get("server_connection")

        stash = StashInterface(FRAGMENT_SERVER)
        stash_config = stash.get_configuration()

        local_api_key = stash_config.get("general", {}).get("apiKey")
        if not local_api_key:
            log.warning("Local API key not found. Proceeding without it.")

        return FRAGMENT_SERVER, local_api_key
    except Exception as e:
        log.error(f"Error retrieving Stash connection info: {e}")
        return None, None

def get_download_path(api_key):
    """
    Fetch the custom download path from the plugin configuration.
    """
    query = """
    query Configuration {
        configuration {
            plugins
        }
    }
    """
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["ApiKey"] = api_key

    try:
        response = requests.post(DEFAULT_GRAPHQL_URL, json={"query": query}, headers=headers)
        if response.status_code == 200:
            data = response.json()
            plugin_config = data.get("data", {}).get("configuration", {}).get("plugins", {})
            download_path = plugin_config.get("performerGallery", {}).get("Download Path")
            if download_path and os.path.isdir(download_path):
                return download_path
        log.warning("Invalid or missing custom download path. Using default path.")
    except requests.RequestException as e:
        log.error(f"Error fetching download path: {e}")
    return default_dlpath

def scrapePerformer(name, page=1):
    r = s.get(f"https://www.porngals4.com/{name}/{page}")
    re_match_search = re.compile(r'<div class="item">\s*<div class="img">\s*<a href="(/%s.+?)" .+?>' % name)
    match = re_match_search.findall(r.text)
    return match

def getGallery(path, name):
    r = s.get(f"https://www.porngals4.com{path}")
    re_match_search = re.compile(r'<a href="(https:\/\/b\..+?)"')
    match = re_match_search.findall(r.text)
    cleaned = [img for img in match if name in img]
    return cleaned

def download_image(folder, url):
    r = s.get(url)
    path = os.path.join(folder, url.split("/")[-1])
    with open(path, "wb") as f:
        f.write(r.content)

def download_performer(name, dlpath, total, index):
    targetName = os.path.join(dlpath, name)
    zip_path = f"{targetName}.zip"

    if os.path.exists(zip_path):
        log.info(f"[{index}/{total}] Performer {name} already processed (zip exists). Skipping.")
        return

    if os.path.exists(targetName):
        log.info(f"[{index}/{total}] Resuming download for performer {name} (folder exists).")
    else:
        log.info(f"[{index}/{total}] Starting download for performer {name}.")
        os.makedirs(targetName)

    galleries = scrapePerformer(name)
    for gallery in galleries:
        images = getGallery(gallery, name)
        for image in images:
            download_image(targetName, image)
    log.info(f"[{index}/{total}] Finished downloading performer {name}.")
    shutil.make_archive(targetName, 'zip', targetName)
    log.info(f"[{index}/{total}] Zipped performer {name}.")
    shutil.rmtree(targetName)

def main():
    # Step 1: Retrieve Stash connection info
    server_url, api_key = get_stash_connection_info()
    if not server_url:
        log.error("Unable to retrieve Stash connection info. Exiting.")
        return

    # Step 2: Fetch custom download path
    dlpath = get_download_path(api_key)

    # Step 3: Get all performers from Stash
    stash = StashInterface(server_url)
    performers = stash.find_performers()

    # Step 4: Download galleries for each performer
    total_performers = len(performers)
    for index, performer in enumerate(performers, start=1):
        names = performer["name"].split(" ")
        name = "-".join(names).lower()
        log.progress(index / total_performers)  # Update progress
        download_performer(name, dlpath, total_performers, index)

if __name__ == "__main__":
    main()
