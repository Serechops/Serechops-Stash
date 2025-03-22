import json
import time
import random
import requests
import sys
import shutil
import re
from pathlib import Path
from bs4 import BeautifulSoup
import stashapi.log as log

# --------------------------------
# Babepedia scraper code
# --------------------------------

BASE_URL = "https://www.babepedia.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) "
        "Gecko/20100101 Firefox/108.0"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

def get_babepedia_url_from_stash(performer_urls):
    """Return the first Babepedia URL if present."""
    for url in performer_urls:
        if "babepedia.com/babe/" in url.lower():
            return url
    return None

def make_babepedia_slug(full_url_or_name: str) -> str:
    """
    Extract the part after '/babe/' or fallback to underscores.
    E.g. "Abella Danger" -> "Abella_Danger"
    """
    if "babepedia.com/babe/" in full_url_or_name.lower():
        slug_part = full_url_or_name.split("/babe/")[-1]
        slug_part = slug_part.split("?")[0]
        return slug_part
    else:
        return full_url_or_name.replace(" ", "_")

def scrape_babepedia_galleries_single_page(slug: str):
    """
    Fetch the single Babepedia page for the performer (no pagination).
    Returns a list of galleries, each with 'title', 'url', 'images', 'id'.
    """
    page_url = f"{BASE_URL}/babe/{slug}"
    resp = requests.get(page_url, headers=HEADERS)
    time.sleep(random.uniform(1.0, 2.0))

    if resp.status_code != 200:
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    thumbs_block = soup.find("div", {"id": "thumbs"})
    if not thumbs_block:
        return []

    thumbshots = thumbs_block.find_all("div", class_="thumbshot")
    if not thumbshots:
        return []

    galleries = []
    for shot in thumbshots:
        a_tag = shot.find("a")
        if not a_tag:
            continue

        relative_url = a_tag.get("href", "")
        gallery_url = BASE_URL + relative_url

        # Babepedia galleries often look like /gallery/Abella_Danger/380682
        match = re.search(r'/gallery/[^/]+/(\d+)', relative_url)
        if match:
            gallery_id = match.group(1)
        else:
            gallery_id = "unknown_id"

        span = a_tag.find("span", class_="thumbtext")
        gallery_title = span.get_text(strip=True) if span else "Untitled_Gallery"

        images = scrape_babepedia_gallery_page(gallery_url)
        galleries.append({
            "title": gallery_title,
            "url": gallery_url,
            "images": images,
            "id": gallery_id
        })

    return galleries

def scrape_babepedia_gallery_page(gallery_url: str):
    image_links = []
    resp = requests.get(gallery_url, headers=HEADERS)
    time.sleep(random.uniform(1.0, 2.0))

    if resp.status_code != 200:
        return image_links

    soup = BeautifulSoup(resp.text, "html.parser")
    gallery_div = soup.find("div", id="gallery")
    if not gallery_div:
        return image_links

    a_tags = gallery_div.find_all("a", class_="img", rel="gallery")
    for a in a_tags:
        rel_link = a.get("href")
        if rel_link and rel_link.startswith("/"):
            full_image_url = BASE_URL + rel_link
        else:
            full_image_url = rel_link

        image_links.append(full_image_url)

    return image_links

# --------------------------------
# Plugin main code
# --------------------------------

# fallback: script directory
default_dlpath = Path(__file__).resolve().parent

def post_graphql(server_url, api_key, query, variables=None, session=None):
    """
    Utility for sending a GraphQL query/mutation to Stash at 'server_url'.
    """
    if not session:
        session = requests.Session()

    graphql_url = server_url.rstrip("/") + "/graphql"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["ApiKey"] = api_key

    resp = session.post(graphql_url, json={"query": query, "variables": variables or {}}, headers=headers)
    if resp.status_code != 200:
        raise RuntimeError(f"GraphQL request failed: HTTP {resp.status_code}")

    data = resp.json()
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {data['errors']}")
    return data

def get_plugin_download_path(server_url, api_key, stash_session):
    """
    Reads our plugin’s Download Path from Stash’s configuration,
    logs the entire 'plugins' dict so we can debug any mismatches.
    """
    try:
        log.info("Querying plugin configuration for Download Path…")
        cfg_query = """
        query Configuration {
          configuration {
            plugins
          }
        }
        """
        resp = post_graphql(server_url, api_key, cfg_query, session=stash_session)
        plugins = resp["data"]["configuration"].get("plugins", {})

        settings = plugins.get("babepediaGalleryScraper", {})
        dl_path_str = settings.get("Download Path")

        if not dl_path_str:
            log.warning("'Download Path' not set in babepediaGalleryScraper config.")
            return None

        dl_path = Path(dl_path_str)
        if not dl_path.exists():
            log.info(f"Creating user-defined download directory: {dl_path}")
            dl_path.mkdir(parents=True, exist_ok=True)

        if dl_path.is_dir():
            log.info(f"Using user-defined download directory: {dl_path}")
            return dl_path
        else:
            log.warning(f"Configured Download Path is not a directory: {dl_path}")

    except Exception as e:
        log.error(f"Error reading plugin Download Path: {e}")

    return None

def get_download_path(server_url, api_key, stash_session=None):
    """
    Return the user-defined Download Path if valid, otherwise fallback
    to the script’s own directory.
    """
    user_path = get_plugin_download_path(server_url, api_key, stash_session)
    if user_path:
        return user_path

    fallback = default_dlpath
    log.info(f"Falling back to script directory for downloads: {fallback}")
    return fallback

def get_stash_connection_info():
    """
    Reads plugin JSON from stdin (the 'server_connection') and obtains local_api_key.
    """
    try:
        raw_stdin = sys.stdin.read()
        json_input = json.loads(raw_stdin)

        fragment_server = json_input.get("server_connection")
        if not fragment_server:
            return None, None, None

        stash_session = requests.Session()
        if isinstance(fragment_server, dict):
            scheme = fragment_server.get("Scheme", "http")
            host = fragment_server.get("Host", "localhost")
            port = fragment_server.get("Port", 9999)
            if host == "0.0.0.0":
                host = "localhost"

            server_url = f"{scheme}://{host}:{port}"
            cookie_info = fragment_server.get("SessionCookie")
            if cookie_info and "Name" in cookie_info and "Value" in cookie_info:
                stash_session.cookies.set(cookie_info["Name"], cookie_info["Value"])
        else:
            server_url = fragment_server

        # attempt to get local API key
        query = """
        query GetConfig {
          configuration {
            general {
              apiKey
            }
          }
        }
        """
        data = post_graphql(server_url, None, query, session=stash_session)
        local_api_key = data["data"]["configuration"]["general"].get("apiKey", "")
        return server_url, local_api_key, stash_session

    except:
        return None, None, None

def find_all_performers(server_url, api_key, stash_session=None):
    """
    Query Stash for all performers (the plugin's scope).
    """
    q = """
    query AllPerformers {
      findPerformers(filter: { per_page: -1 }) {
        performers {
          id
          name
          urls
        }
      }
    }
    """
    try:
        data = post_graphql(server_url, api_key, q, session=stash_session)
        return data["data"]["findPerformers"]["performers"]
    except:
        return []

def download_image(image_url, out_folder: Path):
    """
    Download one image into 'out_folder'.
    """
    filename = image_url.split("/")[-1] or f"img_{int(time.time())}.jpg"
    local_path = out_folder / filename

    if local_path.exists():
        return local_path

    try:
        resp = requests.get(image_url, headers=HEADERS, stream=True)
        time.sleep(random.uniform(0.5, 1.0))

        if resp.status_code == 200:
            out_folder.mkdir(parents=True, exist_ok=True)
            with open(local_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            return local_path
    except:
        pass

    return None

def download_performer(performer, dlpath: Path):
    """
    For each performer, check for Babepedia URL, scrape single page,
    subfolders named by gallery ID, then zip, then remove subfolders.
    """
    performer_name = performer["name"]
    log.info(f"Downloading performer: {performer_name}...")

    babepedia_url = get_babepedia_url_from_stash(performer.get("urls", []))
    if not babepedia_url:
        log.info("  -> No Babepedia URL found; skipping.")
        return

    slug = make_babepedia_slug(babepedia_url)
    galleries = scrape_babepedia_galleries_single_page(slug)
    if not galleries:
        log.info("  -> No galleries on Babepedia.")
        return

    performer_folder = dlpath / performer_name.replace(" ", "_")
    performer_folder.mkdir(parents=True, exist_ok=True)

    total_images_downloaded = 0

    for g in galleries:
        subdir_name = g["id"]
        gallery_folder = performer_folder / subdir_name
        gallery_folder.mkdir(parents=True, exist_ok=True)

        for img_url in g["images"]:
            result = download_image(img_url, gallery_folder)
            if result:
                total_images_downloaded += 1

    zip_path = dlpath / f"{performer_name.replace(' ', '_')}.zip"
    try:
        shutil.make_archive(str(zip_path.with_suffix("")), "zip", str(performer_folder))
        shutil.rmtree(performer_folder, ignore_errors=True)
        log.info(f"  -> Zipped {total_images_downloaded} images for {performer_name} into: {zip_path}")
    except Exception as e:
        log.info(f"  -> Failed to zip {performer_name} folder: {e}")

def run_scraping_task():
    """
    Main routine:
    - read server_connection from JSON,
    - retrieve user "Download Path" from plugin config (if valid),
    - loop over all performers, download any Babepedia galleries to subfolders,
    - zip, remove folders.
    """
    server_url, api_key, stash_session = get_stash_connection_info()
    if not server_url:
        log.info("No server URL found in plugin JSON; exiting.")
        return

    dlpath = get_download_path(server_url, api_key, stash_session)
    dlpath.mkdir(parents=True, exist_ok=True)

    log.info(f"Images will be downloaded and zipped into: {dlpath}")

    performers = find_all_performers(server_url, api_key, stash_session)
    if not performers:
        log.info("No performers returned from Stash; exiting.")
        return

    total = len(performers)
    for index, performer in enumerate(performers, start=1):
        log.progress(index / total)
        download_performer(performer, dlpath)

def main():
    run_scraping_task()

if __name__ == "__main__":
    main()
