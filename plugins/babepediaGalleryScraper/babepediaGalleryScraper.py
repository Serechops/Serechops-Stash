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
except Exception as e:
    log.debug(f"Cloudscraper import failed: {e}")
    MODULE_CLOUDSCRAPER = False

# --------------------------------
# Babepedia scraper code
# --------------------------------

BASE_URL = "https://www.babepedia.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
    "TE": "trailers",
}

# A small pool of common User-Agents to rotate if a request gets blocked
_UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
]

def fetch_with_retries(url: str, session: requests.Session = None, max_attempts: int = 5):
    """Fetch URL with retry logic and multiple anti-blocking strategies."""
    
    log.debug(f"fetch_with_retries: Starting for {url}")
    
    # Always use cloudscraper if available - it's designed for this
    if MODULE_CLOUDSCRAPER:
        try:
            log.debug("Cloudscraper: Creating scraper instance")
            # Configure cloudscraper with browser emulation
            scraper = cloudscraper.create_scraper(
                interpreter='js',
                delay=15,
                browser={
                    'browser': 'firefox',
                    'platform': 'windows',
                    'desktop': True,
                    'mobile': False
                }
            )
            
            # Add cookies from session if provided
            if session and session.cookies:
                scraper.cookies.update(session.cookies.get_dict())
                log.debug(f"Cloudscraper: Added {len(session.cookies)} cookies from session")
            
            # Warm up with a request to the main page first (only for first attempt)
            if "babe/" in url:
                try:
                    warm_url = BASE_URL + "/"
                    warm_headers = HEADERS.copy()
                    warm_headers["User-Agent"] = random.choice(_UA_POOL)
                    log.debug(f"Cloudscraper: Warming up with request to {warm_url}")
                    scraper.get(warm_url, headers=warm_headers, timeout=10)
                    log.debug("Cloudscraper: Warm-up complete")
                    time.sleep(random.uniform(3, 5))
                except Exception as e:
                    log.debug(f"Cloudscraper: Warm-up failed (non-fatal): {e}")
            
            # Add random delay before request
            delay = random.uniform(3, 6)
            log.debug(f"Cloudscraper: Waiting {delay:.1f}s before main request")
            time.sleep(delay)
            
            headers = HEADERS.copy()
            headers["User-Agent"] = random.choice(_UA_POOL)
            headers["Referer"] = BASE_URL + "/"
            
            log.debug(f"Cloudscraper: Making request to {url}")
            resp = scraper.get(url, headers=headers, timeout=30)
            log.debug(f"Cloudscraper: Response received with status {resp.status_code}")
            
            if resp.status_code == 200:
                log.debug(f"Cloudscraper: Success for {url}")
                return resp
            else:
                log.debug(f"Cloudscraper: Returned {resp.status_code} for {url}")
                
        except Exception as e:
            log.debug(f"Cloudscraper attempt failed: {e}")
    else:
        log.debug("Cloudscraper not available, using regular requests")
    
    # Fallback to regular session with delays and retries
    if session is None:
        log.debug("Creating new requests session")
        session = requests.Session()
    
    # Update session headers to be more browser-like
    session.headers.update({
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    })
    
    last_exc = None
    last_resp = None
    
    for attempt in range(1, max_attempts + 1):
        log.debug(f"Regular request attempt {attempt}/{max_attempts} for {url}")
        
        try:
            # Progressive delay between attempts
            if attempt > 1:
                delay = attempt * random.uniform(5, 10)
                log.debug(f"Waiting {delay:.1f} seconds before attempt {attempt}")
                time.sleep(delay)
            
            headers = HEADERS.copy()
            headers["User-Agent"] = random.choice(_UA_POOL)
            
            # Add different referers based on URL type
            if "/babe/" in url:
                headers["Referer"] = BASE_URL + "/"
            elif "/gallery/" in url:
                headers["Referer"] = url.replace("/gallery/", "/babe/").rsplit('/', 1)[0]
            
            log.debug(f"Making request with UA: {headers['User-Agent'][:50]}...")
            resp = session.get(url, headers=headers, timeout=30)
            log.debug(f"Request completed with status: {resp.status_code}")
            
            if resp.status_code == 200:
                log.debug(f"Success on attempt {attempt}")
                return resp
            elif resp.status_code == 403:
                log.debug(f"Attempt {attempt}: Got 403, waiting longer...")
                time.sleep(attempt * random.uniform(8, 12))
                last_resp = resp
            elif resp.status_code == 429:  # Too Many Requests
                log.debug(f"Attempt {attempt}: Rate limited (429), waiting extra...")
                time.sleep(attempt * random.uniform(15, 20))
                last_resp = resp
            else:
                log.debug(f"Attempt {attempt}: Status {resp.status_code}")
                last_resp = resp
                
        except requests.exceptions.Timeout as e:
            last_exc = e
            log.debug(f"Attempt {attempt} timeout: {e}")
            time.sleep(attempt * random.uniform(5, 10))
        except requests.exceptions.ConnectionError as e:
            last_exc = e
            log.debug(f"Attempt {attempt} connection error: {e}")
            time.sleep(attempt * random.uniform(5, 10))
        except Exception as e:
            last_exc = e
            log.debug(f"Attempt {attempt} failed with exception: {type(e).__name__}: {e}")
            time.sleep(attempt * random.uniform(5, 10))
    
    if last_exc:
        log.error(f"Failed to fetch {url} after {max_attempts} attempts: {last_exc}")
    elif last_resp:
        log.error(f"Failed to fetch {url} after {max_attempts} attempts, last status: {last_resp.status_code}")
    
    return None

def get_babepedia_url_from_stash(performer_urls):
    """Returns the first Babepedia performer URL if present; otherwise None."""
    log.debug(f"Checking {len(performer_urls)} URLs for Babepedia")
    for url in performer_urls:
        if "babepedia.com/babe/" in url.lower():
            log.debug(f"Found Babepedia URL: {url}")
            return url
    log.debug("No Babepedia URL found")
    return None

def make_babepedia_slug(full_url_or_name: str) -> str:
    """Extract the part after '/babe/' if it's a full Babepedia URL."""
    if "babepedia.com/babe/" in full_url_or_name.lower():
        slug_part = full_url_or_name.split("/babe/")[-1]
        slug_part = slug_part.split("?")[0]
        log.debug(f"Extracted slug '{slug_part}' from URL")
        return slug_part
    else:
        slug = full_url_or_name.replace(" ", "_")
        log.debug(f"Created slug '{slug}' from name")
        return slug

def scrape_babepedia_galleries_single_page(slug: str, session: requests.Session = None):
    """
    For a single babe 'slug' (e.g. 'Abella_Danger'), fetch the single
    Babepedia page. Return a list of galleries.
    """
    page_url = f"{BASE_URL}/babe/{slug}"
    log.debug(f"scrape_babepedia_galleries_single_page: Starting for slug '{slug}', URL: {page_url}")
    
    # Add random delay before request
    delay = random.uniform(3, 6)
    log.debug(f"Waiting {delay:.1f}s before fetching performer page")
    time.sleep(delay)
    
    log.debug("Calling fetch_with_retries for performer page")
    resp = fetch_with_retries(page_url, session=session)
    
    if not resp:
        log.info(f"No response when fetching performer page for slug {slug}")
        return []
    if resp.status_code != 200:
        log.info(f"Non-200 ({resp.status_code}) when fetching performer page for slug {slug}")
        return []

    log.debug(f"Successfully fetched performer page, response size: {len(resp.text)} bytes")
    
    log.debug("Parsing HTML with BeautifulSoup")
    soup = BeautifulSoup(resp.text, "html.parser")

    # Primary attempt: container with id="thumbs" or the whole page.
    thumbs_block = soup.find("div", id="thumbs")
    if thumbs_block:
        log.debug("Found 'thumbs' div")
    else:
        log.debug("No 'thumbs' div found, searching entire page")
    
    galleries = []
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

    def add_gallery_from_href(href, title_hint=None):
        if not href:
            return
        if href.startswith('http') and not href.startswith(BASE_URL):
            return
            
        relative_url = href
        if href.startswith(BASE_URL):
            relative_url = href[len(BASE_URL):]
            
        if '/gallery/' in relative_url:
            gallery_url = BASE_URL + relative_url if relative_url.startswith('/') else BASE_URL + '/' + relative_url
            match = re.search(r'/gallery/[^/]+/(\d+)', relative_url)
            if match:
                gallery_id = match.group(1)
                log.debug(f"Found gallery ID: {gallery_id}")
            else:
                safe_id = re.sub(r'[^\w\-_]', '_', relative_url.split('/')[-1] or 'gallery')
                gallery_id = safe_id[:50]
                log.debug(f"Created gallery ID from URL: {gallery_id}")
            gallery_title = title_hint or f"gallery_{gallery_id}"
            log.debug(f"Fetching gallery page: {gallery_url}")
            images = scrape_babepedia_gallery_page(gallery_url, session=session)
            log.debug(f"Found {len(images)} images in gallery {gallery_id}")
            galleries.append({"title": gallery_title, "url": gallery_url, "images": images, "id": gallery_id})

    # Search in the thumbs block first
    search_scope = thumbs_block if thumbs_block else soup
    links_found = len(list(search_scope.find_all('a', href=True)))
    log.debug(f"Found {links_found} links in search scope")
    
    for a in search_scope.find_all('a', href=True):
        href = a['href']
        if href.startswith('http') and not href.startswith(BASE_URL):
            continue
            
        if '/galleries/' in href and re.search(r'\.(jpe?g|png|webp|gif)$', href, re.IGNORECASE):
            base = href.rsplit('/', 1)[0]
            base_abs = abs_url(base)
            img_abs = abs_url(href)
            if base_abs and img_abs:
                galleries_by_base.setdefault(base_abs, []).append(img_abs)
                log.debug(f"Added direct gallery image: {img_abs}")
            continue
            
        if '/user-uploads/' in href and re.search(r'\.(jpe?g|png|webp|gif)$', href, re.IGNORECASE):
            base = href.rsplit('/', 1)[0]
            base_abs = abs_url(base)
            img_abs = abs_url(href)
            if base_abs and img_abs:
                galleries_by_base.setdefault(base_abs, []).append(img_abs)
                log.debug(f"Added user upload image: {img_abs}")
            continue
            
        if '/gallery/' in href:
            span = a.find("span", class_="thumbtext")
            title_hint = span.get_text(strip=True) if span else (a.get_text(strip=True) or None)
            log.debug(f"Found gallery link: {href} with title hint: {title_hint}")
            add_gallery_from_href(href, title_hint)

    log.debug(f"Found {len(galleries_by_base)} direct gallery bases")
    
    # Convert direct galleries to gallery entries
    for base, imgs in galleries_by_base.items():
        base_path = base.rstrip('/').split('/')[-1]
        if 'user-uploads' in base:
            gid = "user_uploads"
            title = f"User Uploads ({len(imgs)} photos)"
            log.debug(f"Creating user uploads gallery with {len(imgs)} images")
        else:
            gid = re.sub(r'[^\w\-_]', '_', base_path)[:50]
            if not gid:
                gid = f"gallery_{int(time.time())}"
            title = imgs[0].split('/')[-2] if imgs else gid
            log.debug(f"Creating gallery '{gid}' with {len(imgs)} images")
            
        seen_imgs = set()
        final_imgs = []
        for u in imgs:
            if u not in seen_imgs:
                final_imgs.append(u)
                seen_imgs.add(u)
        galleries.append({"title": title, "url": base, "images": final_imgs, "id": gid})

    # Deduplicate by id while preserving order
    seen = set()
    deduped = []
    for g in galleries:
        if g['id'] not in seen:
            deduped.append(g)
            seen.add(g['id'])

    log.debug(f"Returning {len(deduped)} unique galleries")
    return deduped

def scrape_babepedia_gallery_page(gallery_url: str, session: requests.Session = None):
    """
    Given a single gallery page's URL, fetch all image links.
    """
    log.debug(f"scrape_babepedia_gallery_page: Starting for {gallery_url}")
    image_links = []
    
    # Add random delay before request
    delay = random.uniform(3, 6)
    log.debug(f"Waiting {delay:.1f}s before fetching gallery page")
    time.sleep(delay)
    
    log.debug("Calling fetch_with_retries for gallery page")
    resp = fetch_with_retries(gallery_url, session=session)
    
    if not resp:
        log.info(f"No response when fetching gallery page: {gallery_url}")
        return image_links
    if resp.status_code != 200:
        log.info(f"Non-200 ({resp.status_code}) when fetching gallery page: {gallery_url}")
        return image_links

    log.debug(f"Successfully fetched gallery page, response size: {len(resp.text)} bytes")
    
    log.debug("Parsing HTML with BeautifulSoup")
    soup = BeautifulSoup(resp.text, "html.parser")

    # Try multiple ways to find images
    candidates = []
    
    # Look for the gallery images - Babepedia often uses a specific structure
    gallery_div = soup.find("div", id="gallery")
    if gallery_div:
        log.debug("Found div#gallery")
        
        # Find all image links in the gallery
        gallery_links = gallery_div.find_all('a', href=True)
        log.debug(f"Found {len(gallery_links)} links in gallery div")
        for a in gallery_links:
            href = a['href']
            if re.search(r'\.(jpe?g|png|webp|gif)$', href, re.IGNORECASE):
                candidates.append(href)
                log.debug(f"Found image link: {href[:100]}...")
        
        # Also check for img tags
        gallery_imgs = gallery_div.find_all('img')
        log.debug(f"Found {len(gallery_imgs)} img tags in gallery div")
        for img in gallery_imgs:
            src = img.get('src') or img.get('data-src') or img.get('data-lazy')
            if src and re.search(r'\.(jpe?g|png|webp|gif)$', src, re.IGNORECASE):
                candidates.append(src)
                log.debug(f"Found img src: {src[:100]}...")
    else:
        log.debug("No div#gallery found, searching entire page")
    
    # Also check for the "View full size" links
    full_size_links = soup.find_all('a', href=True)
    for a in full_size_links:
        text = a.get_text(strip=True)
        if text in ['View full size', 'Full size', 'Original']:
            href = a['href']
            if href:
                candidates.append(href)
                log.debug(f"Found full size link: {href[:100]}...")

    log.debug(f"Found {len(candidates)} candidate image URLs before normalization")

    # Normalize URLs and dedupe
    seen_urls = set()
    for src in candidates:
        if not src:
            continue
        src = src.strip()
        if src.startswith('//'):
            src = 'https:' + src
        elif src.startswith('/'):
            src = BASE_URL + src
        elif not re.match(r'^https?://', src):
            src = gallery_url.rstrip('/') + '/' + src.lstrip('/')

        if src not in seen_urls:
            seen_urls.add(src)
            image_links.append(src)
            log.debug(f"Added normalized URL: {src[:100]}...")

    log.debug(f"Returning {len(image_links)} unique image URLs")
    return image_links

# --------------------------------
# Plugin main code (unchanged from original)
# --------------------------------

default_dlpath = Path(__file__).resolve().parent

def post_graphql(server_url, api_key, query, variables=None, session=None):
    """Utility for sending a GraphQL query/mutation to Stash."""
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
    """Reads plugin's Download Path from Stash configuration."""
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
    """Return user-defined Download Path if valid, otherwise fallback."""
    user_path = get_plugin_download_path(server_url, api_key, stash_session)
    if user_path:
        return user_path

    fallback = default_dlpath
    log.info(f"Falling back to script directory for downloads: {fallback}")
    return fallback

def get_stash_connection_info():
    """Reads plugin JSON from stdin and obtains connection info."""
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

        # Get local API key
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
    """Query Stash for all performers."""
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
        performers = data["data"]["findPerformers"]["performers"]
        log.debug(f"Found {len(performers)} performers in Stash")
        return performers
    except Exception as e:
        log.error(f"Error fetching performers: {e}")
        return []

def download_image(image_url, out_folder: Path):
    """Download one image into 'out_folder'."""
    log.debug(f"download_image: Starting for {image_url[:100]}...")
    
    try:
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(image_url)
        
        path_filename = parsed.path.split("/")[-1] if parsed.path else ""
        
        if not path_filename or not re.search(r'\.(jpe?g|png|webp|gif)$', path_filename, re.IGNORECASE):
            query_params = parse_qs(parsed.query)
            file_id = None
            for param in ['g', 'id', 'image', 'img']:
                if param in query_params:
                    file_id = query_params[param][0]
                    break
            
            if not file_id:
                file_id = str(int(time.time()))
            
            safe_id = re.sub(r'[^\w\-_]', '_', file_id)
            filename = f"{safe_id}.jpg"
            log.debug(f"Generated filename from ID: {filename}")
        else:
            filename = re.sub(r'[^\w\-_.]', '_', path_filename)
            log.debug(f"Using path filename: {filename}")
            
    except Exception as e:
        log.debug(f"Error parsing filename, using fallback: {e}")
        filename = f"img_{int(time.time())}.jpg"
    
    local_path = out_folder / filename

    if local_path.exists():
        log.debug(f"File already exists: {local_path}")
        return local_path

    try:
        # Add delay before downloading image
        delay = random.uniform(1, 3)
        log.debug(f"Waiting {delay:.1f}s before downloading image")
        time.sleep(delay)
        
        headers = HEADERS.copy()
        headers["User-Agent"] = random.choice(_UA_POOL)
        headers["Referer"] = BASE_URL + "/"
        
        log.debug(f"Downloading image to {local_path}")
        resp = requests.get(image_url, headers=headers, stream=True, timeout=30)

        if resp.status_code == 200:
            out_folder.mkdir(parents=True, exist_ok=True)
            with open(local_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            log.debug(f"Successfully downloaded image, size: {local_path.stat().st_size} bytes")
            return local_path
        else:
            log.debug(f"Failed to download image, status: {resp.status_code}")
            
    except Exception as e:
        log.error(f"Error downloading image {image_url}: {e}")

    return None

def download_performer(performer, dlpath: Path, session: requests.Session = None):
    """Process a single performer."""
    performer_name = performer["name"]
    log.debug(f"download_performer: Starting for '{performer_name}'")
    
    zip_path = dlpath / f"{performer_name.replace(' ', '_')}.zip"
    
    if zip_path.exists():
        log.info(f"Skipping '{performer_name}' => zip file already exists.")
        return

    babepedia_url = get_babepedia_url_from_stash(performer.get("urls", []))
    if not babepedia_url:
        log.debug(f"No Babepedia URL for {performer_name}, skipping")
        return

    log.info(f"Downloading performer: {performer_name}... (Babepedia URL found)")

    slug = make_babepedia_slug(babepedia_url)
    
    # Add delay between performers
    delay = random.uniform(5, 10)
    log.debug(f"Waiting {delay:.1f}s before fetching galleries")
    time.sleep(delay)
    
    log.debug(f"Calling scrape_babepedia_galleries_single_page for {slug}")
    galleries = scrape_babepedia_galleries_single_page(slug, session=session)
    
    if not galleries:
        log.info(f"  -> No galleries on Babepedia for {performer_name}.")
        return
    
    log.info(f"  -> Found {len(galleries)} galleries for {performer_name}")

    performer_folder = dlpath / performer_name.replace(" ", "_")
    performer_folder.mkdir(parents=True, exist_ok=True)
    log.debug(f"Created performer folder: {performer_folder}")

    total_images_downloaded = 0

    for g_idx, g in enumerate(galleries, 1):
        subdir_name = g["id"]
        gallery_folder = performer_folder / subdir_name
        gallery_folder.mkdir(parents=True, exist_ok=True)
        
        log.debug(f"Processing gallery {g_idx}/{len(galleries)}: {subdir_name} with {len(g['images'])} images")

        for img_idx, img_url in enumerate(g["images"], 1):
            log.debug(f"Downloading image {img_idx}/{len(g['images'])} from gallery {subdir_name}")
            if download_image(img_url, gallery_folder):
                total_images_downloaded += 1
                if img_idx % 10 == 0:
                    log.debug(f"Downloaded {img_idx}/{len(g['images'])} images in this gallery")
            # Small delay between images
            time.sleep(random.uniform(0.5, 1.5))

    log.debug(f"Total images downloaded: {total_images_downloaded}")

    try:
        log.debug(f"Creating zip archive: {zip_path}")
        shutil.make_archive(str(zip_path.with_suffix("")), "zip", str(performer_folder))
        log.debug(f"Removing temporary folder: {performer_folder}")
        shutil.rmtree(performer_folder, ignore_errors=True)
        log.info(f"  -> Zipped {total_images_downloaded} images for {performer_name} into: {zip_path}")
    except Exception as e:
        log.error(f"  -> Failed to zip {performer_name} folder: {e}")

def run_scraping_task():
    """Main routine."""
    log.debug("run_scraping_task: Starting")
    
    server_url, api_key, stash_session = get_stash_connection_info()
    if not server_url:
        log.info("No server URL found in plugin JSON; exiting.")
        return

    dlpath = get_download_path(server_url, api_key, stash_session)
    dlpath.mkdir(parents=True, exist_ok=True)

    log.info(f"Images will be downloaded and zipped into: {dlpath}")

    all_performers = find_all_performers(server_url, api_key, stash_session)
    total = len(all_performers)
    log.info(f"Found {total} performers to process")
    
    for index, performer in enumerate(all_performers, start=1):
        log.progress(index / total)
        log.debug(f"Processing performer {index}/{total}: {performer['name']}")
        download_performer(performer, dlpath, session=stash_session)
        
        # Add longer delay between performers to avoid rate limiting
        if index < total:
            delay = random.uniform(10, 20)
            log.debug(f"Waiting {delay:.1f} seconds before next performer...")
            time.sleep(delay)
    
    log.debug("run_scraping_task: Completed")

def main():
    cli_urls = sys.argv[1:]
    
    if "--test" in cli_urls:
        cli_urls.remove("--test")
        if not cli_urls and not sys.stdin.isatty():
            raw = sys.stdin.read().strip()
            if raw:
                cli_urls = [line.strip() for line in raw.splitlines() if line.strip()]
    
    if cli_urls:
        log.debug(f"Running in test mode with {len(cli_urls)} URLs")
        session = requests.Session()
        results = []
        for url in cli_urls:
            try:
                if "/gallery/" in url:
                    imgs = scrape_babepedia_gallery_page(url, session=session)
                    results.append({"url": url, "type": "gallery", "count": len(imgs), "sample": imgs[:10]})
                else:
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
                # Delay between test requests
                time.sleep(random.uniform(5, 10))
            except Exception as e:
                log.error(f"Error processing {url}: {e}")
                results.append({"url": url, "error": str(e)})

        print(json.dumps(results, indent=2))
        return

    # Default behavior: run as plugin
    run_scraping_task()

if __name__ == "__main__":
    main()