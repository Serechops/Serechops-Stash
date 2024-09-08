import requests
from bs4 import BeautifulSoup
import json
import os

# Define the URL for Bang videos page
url = "https://www.bang.com/videos?by=date&is4k=1"

# Send a GET request to fetch the page content
response = requests.get(url)

# Parse the HTML content
soup = BeautifulSoup(response.content, "html.parser")

# Find all scene containers by their class name
scene_containers = soup.find_all("div", class_="video_container")

scenes = []

# Loop through each scene container and extract the relevant information
for container in scene_containers:
    # Extract the scene title
    title_tag = container.find("span", class_="block text-xs lg:text-sm text-default font-semibold truncate mt-1 text-left")
    title = title_tag.text.strip() if title_tag else "Unknown Title"

    # Extract the link to the scene
    link_tag = container.find("a", class_="relative video_inner_container group")
    scene_link = "https://www.bang.com" + link_tag["href"] if link_tag else "#"

    # Extract the thumbnail image
    image_tag = container.find("img", class_="preview-img")
    image_url = image_tag["src"] if image_tag else ""

    # Extract performers' names
    performer_tag = container.find("a", class_="scrollup text-aero font-medium capitalize hover:underline focus:underline comma truncate")
    performers = performer_tag.text.strip() if performer_tag else "Unknown Performers"

    # Extract the release date
    date_tag = container.find("span", class_="hidden xs:inline-block truncate")
    date = date_tag.text.strip() if date_tag else "Unknown Date"

    # Extract the video preview URL from the 'data-videopreview-sources-value' attribute
    video_preview_data = link_tag["data-videopreview-sources-value"] if link_tag else ""
    video_url = ""

    if video_preview_data:
        try:
            # Convert the JSON-like string into a dictionary
            video_sources = json.loads(video_preview_data.replace('&quot;', '"'))
            # Extract the best available video quality, falling back to lower resolutions
            video_url = video_sources.get("mp4_large", video_sources.get("mp4", ""))
        except json.JSONDecodeError:
            print(f"Error decoding video preview data for scene: {title}")

    # Store the scene info in a dictionary
    scenes.append({
        "title": title,
        "link": scene_link,
        "image": image_url,
        "performers": [performers],
        "date": date,
        "video": video_url
    })

# Get the current working directory
current_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(current_dir, 'bang_scenes.json')

# Write the scene data to a JSON file in the current working directory
with open(output_file, 'w') as json_file:
    json.dump(scenes, json_file, indent=4)

print(f"Scenes data has been saved to {output_file}")
