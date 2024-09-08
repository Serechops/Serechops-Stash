import requests
from bs4 import BeautifulSoup
import json
import os
import time

# Define the base URL for Vixen
base_url = "https://www.vixen.com"

# Define the URL for Vixen scenes page
url = "https://www.vixen.com/videos"

# Send a GET request to fetch the page content
response = requests.get(url)

# Check if the request was successful
if response.status_code == 200:
    print(f"Successfully fetched the page: {url}")
else:
    print(f"Failed to retrieve the page: {response.status_code}")
    exit()

# Parse the HTML content
soup = BeautifulSoup(response.content, "html.parser")

# Find all scene containers
scene_containers = soup.find_all("div", class_="Grid__Item-f0cb34-1")

scenes = []

# Loop through each scene container and extract the relevant information
for container in scene_containers:
    try:
        # Extract the scene title and link
        link_tag = container.find("a", class_="VideoThumbnailPreview__VideoThumbnailLink-sc-1l0c3o7-8")
        title = link_tag.get("title") if link_tag else "Unknown Title"
        scene_link = base_url + link_tag.get("href") if link_tag else "#"

        # Visit the scene page to extract more data
        scene_response = requests.get(scene_link)
        if scene_response.status_code != 200:
            print(f"Failed to retrieve the scene page: {scene_link}")
            continue

        scene_soup = BeautifulSoup(scene_response.content, "html.parser")

        # Extract performers' names
        performer_tags = scene_soup.find_all("a", class_="ModelLinks__StyledLink-bycjqw-0")
        performers = [performer.text.strip() for performer in performer_tags] if performer_tags else ["Unknown Performers"]

        # Extract the release date
        date_tag = scene_soup.find("button", {"data-test-component": "ReleaseDate"})
        release_date = date_tag.text.strip() if date_tag else "Unknown Date"

        # Extract the description
        description_tag = scene_soup.find("div", {"data-test-component": "VideoDescription"})
        description = description_tag.text.strip() if description_tag else "No description available."

        # Extract the director's name
        director_tag = scene_soup.find("span", {"data-test-component": "DirectorText"})
        director = director_tag.text.strip() if director_tag else "Unknown Director"

        # Extract the highest quality image from the <picture> tag
        picture_tag = scene_soup.find("picture", {"data-test-component": "ProgressiveImageImage"})
        img_tag = picture_tag.find("img") if picture_tag else None
        image_url = img_tag.get("src") if img_tag else "No image available"

        # Store the scene info in a dictionary
        scenes.append({
            "title": title,
            "link": scene_link,
            "image": image_url,
            "performers": performers,
            "date": release_date,
            "description": description,
            "director": director
        })

        # Sleep for a short time to avoid overwhelming the server
        time.sleep(1)

    except Exception as e:
        print(f"Error processing scene: {e}")
        continue

# Get the current working directory
current_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(current_dir, 'vixen_scenes.json')

# Write the scene data to a JSON file in the current working directory
with open(output_file, 'w') as json_file:
    json.dump(scenes, json_file, indent=4)

print(f"Scenes data has been saved to {output_file}")
