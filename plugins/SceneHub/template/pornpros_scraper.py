import requests
from bs4 import BeautifulSoup
import json
import os

# Define the URLs for all the sites
sites = {
    "lubed": "https://www.lubed.com/",
    "holed": "https://holed.com/",
    "tiny4k": "https://tiny4k.com/",
    "exotic4k": "https://exotic4k.com/",
    "pornpros": "https://pornpros.com/"
}

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))

# Function to scrape a site
def scrape_site(site_name, url, latest_movies_string):
    response = requests.get(url)
    soup = BeautifulSoup(response.content, "html.parser")

    # Find the "Latest Movies" section by the title
    latest_movies_section = soup.find("p", class_="title w-full uppercase font-semibold", string=latest_movies_string)

    if latest_movies_section:
        # The section will contain divs with video cards
        scene_cards = latest_movies_section.find_next("div").find_all("div", class_="video-thumbnail")

        scenes = []

        # Loop through each video card and extract the relevant information
        for card in scene_cards:
            # Extract the scene title
            title_tag = card.find("a", class_="title")
            title = title_tag.text.strip() if title_tag else "Unknown Title"

            # Extract the link to the scene
            scene_link = url.rstrip("/") + title_tag["href"] if title_tag else "#"

            # Extract the video preview URL
            video_tag = card.find("video")
            video_preview_url = ""

            if video_tag:
                # Try to get the video URL from the data-src attribute first
                source_tag = video_tag.find("source")
                if source_tag and source_tag.has_attr("data-src"):
                    video_preview_url = source_tag["data-src"]
                elif source_tag and source_tag.has_attr("src"):
                    video_preview_url = source_tag["src"]

            # Extract the poster image (static preview)
            poster_url = video_tag["poster"] if video_tag and video_tag.has_attr("poster") else ""

            # Extract the performers' names
            performer_tag = card.find("p", class_="actor-list")
            performers = [a.text.strip() for a in performer_tag.find_all("a")] if performer_tag else ["Unknown performers"]

            # Extract the release date from the footer
            date_tag = card.find("span", class_="text-xs font-extra-light text-white text-opacity-50")
            date = date_tag.text.strip() if date_tag else "Unknown Date"

            # Store the scene info in a dictionary
            scenes.append({
                "title": title,
                "link": scene_link,
                "video": video_preview_url,
                "image": poster_url,  # Poster image added here
                "performers": performers,
                "date": date
            })

        # Write the scene data to a JSON file in the current script's directory
        json_filename = os.path.join(script_dir, f'{site_name}_scenes.json')
        with open(json_filename, 'w') as json_file:
            json.dump(scenes, json_file, indent=4)

        print(f"Scenes data has been saved to {json_filename}")

    else:
        print(f"Latest {latest_movies_string} section not found on {site_name}.")

# Iterate over all the sites and scrape them
for site_name, url in sites.items():
    if site_name == "lubed":
        scrape_site(site_name, url, "Latest Lubed Movies")
    elif site_name == "holed":
        scrape_site(site_name, url, "Latest Holed Movies")
    elif site_name == "tiny4k":
        scrape_site(site_name, url, "Latest Tiny4K Movies")
    elif site_name == "exotic4k":
        scrape_site(site_name, url, "Latest Exotic4k Movies")
    elif site_name == "pornpros":
        scrape_site(site_name, url, "Latest Porn Pros Movies")
