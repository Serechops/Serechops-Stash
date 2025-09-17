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

try:
    import cloudscraper  # pip install cloudscraper
    MODULE_CLOUDSCRAPER = True
except Exception:
    MODULE_CLOUDSCRAPER = False

# --------------------------------
# Babepedia scraper code
# --------------------------------

BASE_URL = "https://www.babepedia.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) "
        "Gecko/20100101 Firefox/143.0"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-GPC": "1",
    "TE": "trailers",
}

# A small pool of common User-Agents to rotate if a request gets blocked
_UA_POOL = [
    HEADERS["User-Agent"],
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.96 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
]

def fetch_with_retries(url: str, session: requests.Session = None, max_attempts: int = 3):
    """Fetch URL with a small retry loop and browser-like fallbacks.

    Returns the Response or None on fatal failure.
    """
    if session is None:
        session = requests.Session()

    # Warm-up: hit the site root once to get cookies / any basic protections out of the way
    try:
        wu_headers = HEADERS.copy()
        wu_headers["User-Agent"] = random.choice(_UA_POOL)
        session.get(BASE_URL + '/', headers=wu_headers, timeout=10)
    except Exception:
        # non-fatal; continue to attempts
        pass

    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            headers = HEADERS.copy()
            # If cloudscraper is available, try it first on the first attempt
            if MODULE_CLOUDSCRAPER and attempt == 1:
                try:
                    cs = cloudscraper.create_scraper()
                    resp = cs.get(url, headers=headers, timeout=20)
                    if resp.status_code == 200:
                        return resp
                    else:
                        log.debug(f"Cloudscraper returned {resp.status_code} for {url}")
                except Exception as e:
                    log.debug(f"Cloudscraper attempt failed for {url}: {e}")
                    # fall through to session-based attempts
            # Always include additional browser-like headers to avoid simple bot detection
            headers.update({
                "Referer": BASE_URL + "/",
                "Origin": BASE_URL,
                "Accept-Encoding": "gzip, deflate, br",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-User": "?1",
                "sec-ch-ua": '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"Windows"',
            })
            # rotate UA on each attempt
            headers["User-Agent"] = random.choice(_UA_POOL)

            resp = session.get(url, headers=headers, timeout=20)
            if resp.status_code == 200:
                return resp
            else:
                log.debug(f"Fetch attempt {attempt} for {url} returned status {resp.status_code}")
                # small backoff
                time.sleep(0.5 * attempt)
                last_resp = resp
                continue
        except Exception as e:
            last_exc = e
            log.debug(f"Fetch attempt {attempt} for {url} raised: {e}")
            time.sleep(0.5 * attempt)

    if last_exc:
        log.error(f"Failed to fetch {url}: {last_exc}")
    else:
        # If we have a last_resp it likely had a non-200 status
        try:
            log.error(f"Failed to fetch {url}, last status: {last_resp.status_code}")
        except Exception:
            log.error(f"Failed to fetch {url}, unknown error")
    return None

def get_babepedia_url_from_stash(performer_urls):
    """
    Returns the first Babepedia performer URL if present; otherwise None.
    Example usage:
      performer_urls = [
          "https://dbnaked.com/models/A/Abella-Danger",
          "https://www.babepedia.com/babe/Abella_Danger",
          ...
      ]
      => returns "https://www.babepedia.com/babe/Abella_Danger"
    """
    for url in performer_urls:
        if "babepedia.com/babe/" in url.lower():
            return url
    return None

def make_babepedia_slug(full_url_or_name: str) -> str:
    """
    Extract the part after '/babe/' if it’s a full Babepedia URL,
    otherwise convert spaces => underscores.
    E.g. "Abella Danger" => "Abella_Danger"
         "https://www.babepedia.com/babe/Abella_Danger" => "Abella_Danger"
    """
    if "babepedia.com/babe/" in full_url_or_name.lower():
        slug_part = full_url_or_name.split("/babe/")[-1]
        slug_part = slug_part.split("?")[0]
        return slug_part
    else:
        return full_url_or_name.replace(" ", "_")

def scrape_babepedia_galleries_single_page(slug: str, session: requests.Session = None):
    """
    For a single babe 'slug' (e.g. 'Abella_Danger'), fetch the single
    Babepedia page. Return a list of galleries:
      [
        {
          "title": ...,
          "url": ...,
          "images": [...],
          "id": "380682"  (the numeric part from /gallery/Name/380682)
        },
        ...
      ]
    """
    page_url = f"{BASE_URL}/babe/{slug}"
    resp = fetch_with_retries(page_url, session=session)
    # small pause
    time.sleep(random.uniform(1, 2))

    if not resp:
        log.info(f"No response when fetching performer page for slug {slug}")
        return []
    if resp.status_code != 200:
        log.info(f"Non-200 ({resp.status_code}) when fetching performer page for slug {slug}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    # Primary attempt: container with id="thumbs" or the whole page.
    thumbs_block = soup.find("div", id="thumbs")
    galleries = []

    # Collect direct /galleries/.../NN.jpg links on the performer page and group by base path.
    galleries_by_base = {}

    def abs_url(u):
        if not u:
            return None
        u = u.strip()
        if u.startswith('//'):
            return 'https:' + u
        if u.startswith('/'):
            return BASE_URL + u
        if re.match(r'^https?://', u):
            return u
        return BASE_URL + '/' + u.lstrip('/')

    # helper to add a gallery page link (/gallery/...) and try to fetch images from its page
    def add_gallery_from_href(href, title_hint=None):
        if not href:
            return
        # Skip external URLs that aren't Babepedia galleries
        if href.startswith('http') and not href.startswith(BASE_URL):
            return
            
        relative_url = href
        if href.startswith(BASE_URL):
            relative_url = href[len(BASE_URL):]
        # prefer /gallery/ page links
        if '/gallery/' in relative_url:
            gallery_url = BASE_URL + relative_url if relative_url.startswith('/') else BASE_URL + '/' + relative_url
            match = re.search(r'/gallery/[^/]+/(\d+)', relative_url)
            if match:
                gallery_id = match.group(1)
            else:
                # Create a safe gallery ID from the URL path
                safe_id = re.sub(r'[^\w\-_]', '_', relative_url.split('/')[-1] or 'gallery')
                gallery_id = safe_id[:50]  # Limit length for Windows filesystem
            gallery_title = title_hint or f"gallery_{gallery_id}"
            images = scrape_babepedia_gallery_page(gallery_url, session=session)
            galleries.append({"title": gallery_title, "url": gallery_url, "images": images, "id": gallery_id})

    # Search in the thumbs block first, but also collect any direct gallery image links
    search_scope = thumbs_block if thumbs_block else soup
    for a in search_scope.find_all('a', href=True):
        href = a['href']
        # Skip external URLs that aren't Babepedia
        if href.startswith('http') and not href.startswith(BASE_URL):
            continue
        # direct full-size images use /galleries/.../NN.jpg
        if '/galleries/' in href and re.search(r'\.(jpe?g|png|webp|gif)$', href, re.IGNORECASE):
            base = href.rsplit('/', 1)[0]
            base_abs = abs_url(base)
            img_abs = abs_url(href)
            if base_abs and img_abs:
                galleries_by_base.setdefault(base_abs, []).append(img_abs)
            continue
        # user uploads are in /user-uploads/
        if '/user-uploads/' in href and re.search(r'\.(jpe?g|png|webp|gif)$', href, re.IGNORECASE):
            base = href.rsplit('/', 1)[0]  # Get the user-uploads base path
            base_abs = abs_url(base)
            img_abs = abs_url(href)
            if base_abs and img_abs:
                galleries_by_base.setdefault(base_abs, []).append(img_abs)
            continue
        # otherwise, a link to a /gallery/ page
        if '/gallery/' in href:
            span = a.find("span", class_="thumbtext")
            title_hint = span.get_text(strip=True) if span else (a.get_text(strip=True) or None)
            add_gallery_from_href(href, title_hint)

    # If we collected direct galleries (galleries_by_base), convert them to gallery entries
    for base, imgs in galleries_by_base.items():
        # create a safe id from the base path
        base_path = base.rstrip('/').split('/')[-1]
        if 'user-uploads' in base:
            # For user uploads, create a more descriptive ID
            gid = "user_uploads"
            title = f"User Uploads ({len(imgs)} photos)"
        else:
            gid = re.sub(r'[^\w\-_]', '_', base_path)[:50]  # Create safe directory name
            if not gid:
                gid = f"gallery_{int(time.time())}"  # fallback if no valid chars
            title = imgs[0].split('/')[-2] if imgs else gid
        # dedupe image list while preserving order
        seen_imgs = set()
        final_imgs = []
        for u in imgs:
            if u not in seen_imgs:
                final_imgs.append(u)
                seen_imgs.add(u)
        galleries.append({"title": title, "url": base, "images": final_imgs, "id": gid})

    # Fallback: if no galleries found yet, scan whole page for /gallery/ or /galleries/ links
    if not galleries:
        for a in soup.find_all('a', href=True):
            href = a['href']
            # Skip external URLs that aren't Babepedia
            if href.startswith('http') and not href.startswith(BASE_URL):
                continue
            if '/galleries/' in href and re.search(r'\.(jpe?g|png|webp|gif)$', href, re.IGNORECASE):
                base = href.rsplit('/', 1)[0]
                img_abs = abs_url(href)
                base_abs = abs_url(base)
                if base_abs and img_abs:
                    galleries_by_base.setdefault(base_abs, []).append(img_abs)
            elif '/user-uploads/' in href and re.search(r'\.(jpe?g|png|webp|gif)$', href, re.IGNORECASE):
                base = href.rsplit('/', 1)[0]  # Get the user-uploads base path
                img_abs = abs_url(href)
                base_abs = abs_url(base)
                if base_abs and img_abs:
                    galleries_by_base.setdefault(base_abs, []).append(img_abs)
            elif '/gallery/' in href:
                title_hint = a.get_text(strip=True) or None
                add_gallery_from_href(href, title_hint)

    # Deduplicate by id while preserving order
    seen = set()
    deduped = []
    for g in galleries:
        if g['id'] not in seen:
            deduped.append(g)
            seen.add(g['id'])

    return deduped

def scrape_babepedia_gallery_page(gallery_url: str, session: requests.Session = None):
    """
    Given a single gallery page's URL, fetch all image links from
    <a class="img" rel="gallery">. Return list of direct image URLs.
    """
    image_links = []
    resp = fetch_with_retries(gallery_url, session=session)
    time.sleep(random.uniform(1, 2))
    if not resp:
        log.info(f"No response when fetching gallery page: {gallery_url}")
        return image_links
    if resp.status_code != 200:
        log.info(f"Non-200 ({resp.status_code}) when fetching gallery page: {gallery_url}")
        return image_links

    soup = BeautifulSoup(resp.text, "html.parser")

    # Try multiple ways to find images. Babepedia sometimes uses a div#gallery
    # with <a class="img" rel="gallery"> but may also use <img> tags or lazy-loaded data-src attributes.
    # 1) find anchors with image hrefs
    candidates = []
    for a in soup.find_all('a', href=True):
        href = a['href']
        if re.search(r'\.(jpe?g|png|webp|gif)$', href, re.IGNORECASE):
            candidates.append(href)

    # 2) images inside the gallery div
    gallery_div = soup.find("div", id="gallery")
    if gallery_div:
        # anchors with class img or rel=gallery
        for a in gallery_div.find_all('a', href=True):
            href = a['href']
            if href:
                candidates.append(href)
        # img tags
        for img in gallery_div.find_all('img'):
            src = img.get('src') or img.get('data-src') or img.get('data-lazy')
            if src:
                candidates.append(src)

    # 3) fallback: any img on page
    if not candidates:
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src') or img.get('data-lazy')
            if src and re.search(r'\.(jpe?g|png|webp|gif)$', src, re.IGNORECASE):
                candidates.append(src)

    # normalize urls and dedupe preserving order
    for src in candidates:
        if not src:
            continue
        src = src.strip()
        if src.startswith('//'):
            src = 'https:' + src
        elif src.startswith('/'):
            src = BASE_URL + src
        elif not re.match(r'^https?://', src):
            # relative link
            src = gallery_url.rstrip('/') + '/' + src.lstrip('/')

        if src not in image_links:
            image_links.append(src)

    return image_links

# --------------------------------
# Plugin main code
# --------------------------------

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

    payload = {"query": query, "variables": variables or {}}
    resp = session.post(graphql_url, json=payload, headers=headers)
    if resp.status_code != 200:
        raise RuntimeError(f"GraphQL request failed: HTTP {resp.status_code}")

    data = resp.json()
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {data['errors']}")
    return data

def get_plugin_download_path(server_url, api_key, stash_session):
    """
    Reads our plugin's "Download Path" from Stash’s configuration,
    specifically under 'babepediaGalleryScraper'.
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
    Example single-performer query for reference:
      query FindPerformer {
        findPerformer(id: 3283) {
          id
          name
          urls
        }
      }
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
            # if just a string
            server_url = fragment_server

        # attempt to get local API key from Stash
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

    except Exception as e:
        log.error(f"Error reading server_connection from stdin: {e}")
        return None, None, None

def find_all_performers(server_url, api_key, stash_session=None):
    """
    Query Stash for all performers.
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
    except Exception as e:
        log.error(f"Error fetching performers: {e}")
        return []

def download_image(image_url, out_folder: Path):
    """
    Download one image into 'out_folder'.
    """
    # Extract filename from URL, handling query parameters and creating safe filenames
    try:
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(image_url)
        
        # Try to get original filename from path
        path_filename = parsed.path.split("/")[-1] if parsed.path else ""
        
        # If there's no proper filename from path or it has no extension, create one
        if not path_filename or not re.search(r'\.(jpe?g|png|webp|gif)$', path_filename, re.IGNORECASE):
            # Try to get an ID from query parameters
            query_params = parse_qs(parsed.query)
            file_id = None
            for param in ['g', 'id', 'image', 'img']:
                if param in query_params:
                    file_id = query_params[param][0]
                    break
            
            if not file_id:
                file_id = str(int(time.time()))
            
            # Create safe filename with proper extension
            safe_id = re.sub(r'[^\w\-_]', '_', file_id)
            filename = f"{safe_id}.jpg"
        else:
            # Clean the existing filename
            filename = re.sub(r'[^\w\-_.]', '_', path_filename)
            
    except Exception:
        # Fallback to timestamp-based filename
        filename = f"img_{int(time.time())}.jpg"
    
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
    except Exception as e:
        log.error(f"Error downloading image {image_url}: {e}")
        pass

    return None

def download_performer(performer, dlpath: Path, session: requests.Session = None):
    """
    For each performer, check for Babepedia URL, skip if zip exists,
    scrape single page => subfolders named by gallery ID => zip => remove folder.
    """
    performer_name = performer["name"]
    # if a zip already exists for this performer, skip
    zip_path = dlpath / f"{performer_name.replace(' ', '_')}.zip"
    if zip_path.exists():
        log.info(f"Skipping '{performer_name}' => zip file already exists.")
        return

    babepedia_url = get_babepedia_url_from_stash(performer.get("urls", []))
    if not babepedia_url:
        # no babepedia => skip
        return

    log.info(f"Downloading performer: {performer_name}... (Babepedia URL found)")

    slug = make_babepedia_slug(babepedia_url)
    galleries = scrape_babepedia_galleries_single_page(slug, session=session)
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
            if download_image(img_url, gallery_folder):
                total_images_downloaded += 1

    try:
        shutil.make_archive(str(zip_path.with_suffix("")), "zip", str(performer_folder))
        shutil.rmtree(performer_folder, ignore_errors=True)
        log.info(f"  -> Zipped {total_images_downloaded} images for {performer_name} into: {zip_path}")
    except Exception as e:
        log.error(f"  -> Failed to zip {performer_name} folder: {e}")

def run_scraping_task():
    """
    Main routine:
      - read server_connection from JSON
      - retrieve user "Download Path" from plugin config (if valid)
      - loop over all performers, but only process those that have a Babepedia URL
        and do not already have a .zip in dlpath.
      - download, zip, delete subfolders.
    """
    server_url, api_key, stash_session = get_stash_connection_info()
    if not server_url:
        log.info("No server URL found in plugin JSON; exiting.")
        return

    dlpath = get_download_path(server_url, api_key, stash_session)
    dlpath.mkdir(parents=True, exist_ok=True)

    log.info(f"Images will be downloaded and zipped into: {dlpath}")

    # Fetch all performers
    all_performers = find_all_performers(server_url, api_key, stash_session)
    # Optionally, you can filter out those w/o Babepedia in run_scraping_task,
    # or just let download_performer skip them.

    total = len(all_performers)
    for index, performer in enumerate(all_performers, start=1):
        log.progress(index / total)
        download_performer(performer, dlpath, session=stash_session)

def main():
    # If URLs are provided on the command line, run test mode.
    cli_urls = sys.argv[1:]
    
    # Check for explicit test mode flag
    if "--test" in cli_urls:
        cli_urls.remove("--test")
        # In test mode, read URLs from remaining args or stdin
        if not cli_urls and not sys.stdin.isatty():
            raw = sys.stdin.read().strip()
            if raw:
                cli_urls = [line.strip() for line in raw.splitlines() if line.strip()]
    
    if cli_urls:
        # Run quick test harness using the same session/warmup logic
        session = requests.Session()
        results = []
        for url in cli_urls:
            try:
                if "/gallery/" in url:
                    imgs = scrape_babepedia_gallery_page(url, session=session)
                    results.append({"url": url, "type": "gallery", "count": len(imgs), "sample": imgs[:10]})
                else:
                    # treat as performer URL or name
                    slug = make_babepedia_slug(url)
                    galls = scrape_babepedia_galleries_single_page(slug, session=session)
                    results.append({
                        "url": url,
                        "type": "performer",
                        "galleries": [
                            {"id": g.get("id"), "title": g.get("title"), "count": len(g.get("images", [])), "sample": g.get("images", [])[:5]}
                            for g in galls
                        ],
                    })
            except Exception as e:
                results.append({"url": url, "error": str(e)})

        print(json.dumps(results, indent=2))
        return

    # Default behavior: run as plugin invoked by Stash (expects JSON on stdin)
    run_scraping_task()

if __name__ == "__main__":
    main()
