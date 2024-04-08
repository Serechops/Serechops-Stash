# feederbox826
# GPLv3-ONLY

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
    r = s.get("https://www.porngals4.com/%s/%s" % (name, page))
    re_match_search = re.compile('<div class="item">\s*<div class="img">\s*<a href="(/%s.+?)" .+?>' % name)
    match = re_match_search.findall(r.text)
    return match

def getGallery(path, name):
    r = s.get("https://www.porngals4.com%s" % path)
    re_match_search = re.compile('<a href="(https:\/\/b\..+?)"')
    match = re_match_search.findall(r.text)
    cleaned = [img for img in match if name in img]
    return cleaned

def download_image(folder, url):
    r = s.get(url)
    path = "%s/%s" % (folder, url.split("/")[-1])
    with open(path, "wb") as f:
        f.write(r.content)

def download_performer(name):
    # check if zip already exists
    targetName = "%s/%s" % (dlpath, name)
    if os.path.exists("%s.zip" % targetName):
        log.info("Already downloaded %s" % name)
        return
    # continue downloading
    log.info("Downloading %s" % name)
    galleries = scrapePerformer(name)
    if not os.path.exists(targetName):
        os.makedirs(targetName)
    for gallery in galleries:
        images = getGallery(gallery, name)
        for image in images:
            download_image(targetName, image)
    log.info("Done downloading %s" % name)
    shutil.make_archive(targetName, 'zip', targetName)
    log.info("Zipped %s" % name)
    shutil.rmtree(targetName)

# get all performers
performers = stash.find_performers()

for performer in performers:
    names = performer["name"].split(" ")
    name = "-".join(names).lower()
    download_performer(name)