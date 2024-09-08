import requests
from bs4 import BeautifulSoup
import json
import time
import os

# Define the base URL for NewSensations
base_url = "https://www.newsensations.com"

# Define the URL for NewSensations movies page
url = "https://www.newsensations.com/tour_ns/categories/movies_1_d.html"

# Send a GET request to fetch the page content
response = requests.get(url)
soup = BeautifulSoup(response.content, "html.parser")

# Find all scene containers where the class starts with 'videothumb'
scene_containers = soup.find_all("div", class_=lambda value: value and value.startswith("videothumb"))

scenes = []

# Loop through each scene container and extract the scene link
for container in scene_containers:
    link_tag = container.find("a")
    scene_link = link_tag["href"] if link_tag else "#"
    
    # Ensure the scene link starts with "/" before appending it to the base URL
    if not scene_link.startswith("http"):
        full_scene_url = base_url + scene_link
    else:
        full_scene_url = scene_link

    # Now visit the individual scene URL to get more details
    try:
        scene_response = requests.get(full_scene_url)
        scene_soup = BeautifulSoup(scene_response.content, "html.parser")

        # Extract the title from the h1 tag inside the .indScene block
        scene_block = scene_soup.find("div", class_="indScene")
        title_tag = scene_block.find("h1") if scene_block else None
        title = title_tag.get_text(strip=True) if title_tag else "Unknown Title"

        # Extract the performers from the span.tour_update_models inside the .indScene block
        performers_tag = scene_block.find("span", class_="tour_update_models") if scene_block else None
        performers = [a.get_text(strip=True) for a in performers_tag.find_all("a")] if performers_tag else ["Unknown Performers"]

        # Extract the release date from the .sceneDateP block
        date_tag = scene_block.find("div", class_="sceneDateP") if scene_block else None
        date = date_tag.get_text(strip=True).split(",")[0] if date_tag else "Unknown Date"

        # Extract the video preview URL from the <source> tag inside the <video> tag on the main page
        video_tag = container.find("video")
        source_tag = video_tag.find("source") if video_tag else None
        video_url = source_tag["src"] if source_tag and source_tag.has_attr('src') else ""

        # Extract the fallback poster image from the video tag
        poster_image = video_tag["poster"] if video_tag and video_tag.has_attr('poster') else ""

        # Store the scene info in a dictionary
        scenes.append({
            "title": title,
            "link": full_scene_url,
            "video": video_url,
            "image": poster_image,
            "performers": performers,
            "date": date
        })

        # Optional: sleep to avoid sending too many requests in a short period
        time.sleep(1)

    except requests.exceptions.RequestException as e:
        print(f"Error scraping {full_scene_url}: {e}")

# Get the current working directory
current_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(current_dir, 'newsensations_scenes.json')

# Write the scene data to a JSON file in the current working directory
with open(output_file, 'w') as json_file:
    json.dump(scenes, json_file, indent=4)

print(f"Scenes data has been saved to {output_file}")
