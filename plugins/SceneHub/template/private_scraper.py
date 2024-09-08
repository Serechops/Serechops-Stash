import requests
from bs4 import BeautifulSoup
import json
import os

# Define the base URL for Private
base_url = "https://www.private.com"

# Define the URL for the Private scenes page
url = "https://www.private.com/scenes/"

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
scene_containers = soup.find_all("li", class_="card")

scenes = []

# Loop through each scene container and extract the relevant information
for container in scene_containers:
    try:
        # Extract the scene link and title
        link_tag = container.find("a", {"data-track": "SCENE_LINK"})
        title = link_tag.get("title") if link_tag else "Unknown Title"
        scene_link = link_tag.get("href") if link_tag else "#"
        
        # Extract the image URL
        img_tag = container.find("img", class_="thumbs_onhover")
        image_url = img_tag.get("src") if img_tag else ""

        # Extract performers' names
        performer_tags = container.find_all("a", {"data-track": "PORNSTAR_LINK"})
        performers = [performer.text.strip() for performer in performer_tags] if performer_tags else ["Unknown Performers"]

        # Extract the release date
        date_tag = container.find("span", class_="scene-date")
        release_date = date_tag.text.strip() if date_tag else "Unknown Date"

        # Extract the video preview URL
        video_tag = container.find("video", class_="mini_video_player")
        video_source = video_tag.find("source") if video_tag else None
        video_url = video_source.get("src") if video_source else None

        # Store the scene info in a dictionary
        scenes.append({
            "title": title,
            "link": scene_link,
            "image": image_url,
            "performers": performers,
            "date": release_date,
            "video": video_url
        })

    except Exception as e:
        print(f"Error processing scene: {e}")
        continue

# Get the current working directory
current_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(current_dir, 'private_scenes.json')

# Write the scene data to a JSON file in the current working directory
with open(output_file, 'w') as json_file:
    json.dump(scenes, json_file, indent=4)

print(f"Scenes data has been saved to {output_file}")
