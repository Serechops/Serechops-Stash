# feederbox826
# GPLv3-ONLY

# Modified to target solo galleries of performer by Serechops.

import json
import os
import re
import requests
import shutil
import sys
from stashapi.stashapp import StashInterface
import stashapi.log as log

# get curdir
full_path = os.path.realpath(__file__)
dlpath = os.path.dirname(full_path)

s = requests.Session()
# define stash globally
json_input = json.loads(sys.stdin.read())

FRAGMENT_SERVER = json_input["server_connection"]
stash = StashInterface(FRAGMENT_SERVER)

def scrapePerformer(name, page=1):
    base_url = "https://www.porngals4.com/%s/solo" % name
    if page > 1:
        performer_url = f"{base_url}/{page}/"
    else:
        performer_url = base_url
        
    log.info("Scraping performer %s, page %s: %s" % (name, page, performer_url))
    
    r = s.get(performer_url)
    if r.status_code != 200:
        log.warning("Failed to fetch performer %s, page %s" % (name, page))
        return None
    
    re_match_search = re.compile('<a href="(/.+?)" .+?>')
    match = re_match_search.findall(r.text)
    return match

def getGallery(path):
    r = s.get("https://www.porngals4.com%s" % path)
    re_match_search = re.compile('<a href="(https:\/\/b\..+?)"')
    match = re_match_search.findall(r.text)
    return match

def download_image(folder, url):
    r = s.get(url)
    path = "%s/%s" % (folder, url.split("/")[-1])
    with open(path, "wb") as f:
        f.write(r.content)

def download_performer(name, total_performers, performers_done):
    log.info("Downloading performer: %s" % name)
    
    # check if zip already exists
    targetName = "%s/%s" % (dlpath, name)
    if os.path.exists("%s.zip" % targetName):
        log.info("Already downloaded %s" % name)
        return
    
    # continue downloading
    log.info("Downloading %s" % name)
    galleries = scrapePerformer(name)
    if galleries is None:
        log.info("No galleries found for %s. Skipping." % name)
        return
    
    if not os.path.exists(targetName):
        os.makedirs(targetName)
    for gallery in galleries:
        images = getGallery(gallery)
        for image in images:
            download_image(targetName, image)
    
    log.info("Done downloading %s" % name)
    shutil.make_archive(targetName, 'zip', targetName)
    log.info("Zipped %s" % name)
    shutil.rmtree(targetName)
    
    # Update progress
    performers_done += 1
    progress = performers_done / total_performers
    log.progress(progress)

# get all performers
performers = stash.find_performers()
total_performers = len(performers)
performers_done = 0

for performer in performers:
    names = performer["name"].split(" ")
    name = "-".join(names).lower()
    download_performer(name, total_performers, performers_done)
    performers_done += 1
