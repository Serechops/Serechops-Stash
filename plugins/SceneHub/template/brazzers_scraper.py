import requests
from bs4 import BeautifulSoup
import json
import os

# Define the URL for Brazzers videos page
url = "https://www.brazzers.com/videos/"

# Send a GET request to fetch the page content
response = requests.get(url)

# Parse the HTML content
soup = BeautifulSoup(response.content, "html.parser")

# Find all scene cards by their class name
scene_cards = soup.find_all("div", class_="one-list-1s2gsd8")

scenes = []

# Loop through each scene card and extract the relevant information
for card in scene_cards:
    # Extract the scene title
    title_tag = card.find("a", class_="e1qkfw3j3")
    title = title_tag["title"] if title_tag else "Unknown Title"
    
    # Extract the link to the scene
    scene_link = "https://www.brazzers.com" + title_tag["href"] if title_tag else "#"
    
    # Extract the thumbnail image
    image_tag = card.find("img", class_="one-list-q4dzvk")
    image_url = image_tag["src"] if image_tag else ""
    
    # Extract the date and performers
    date_tag = card.find("div", class_="font-primary e1u5qd1a9 one-list-11ke4mf e1u5qd1a10")
    date = date_tag.text.strip() if date_tag else "Unknown Date"

    performer_tags = card.find_all("a", class_="one-list-hueuj4")
    performers = [p.text for p in performer_tags] if performer_tags else ["Unknown performers"]

    # Extract the video preview URL
    video_tag = card.find("div", class_="one-list-1h1zi5u esqduzl3")  # Locate the div that holds video info
    video_preview_url = ""

    if video_tag:
        # Check for the source tag inside the video block
        source_tag = video_tag.find("source")
        if source_tag and "src" in source_tag.attrs:
            video_preview_url = source_tag["src"]
        else:
            # Fall back to the image if no video preview is available
            video_preview_url = image_url

    # Store the scene info in a dictionary
    scenes.append({
        "title": title,
        "link": scene_link,
        "image": image_url,
        "date": date,
        "performers": performers,
        "video": video_preview_url  # Add the video preview URL
    })

# Get the current working directory
current_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(current_dir, 'brazzers_scenes.json')

# Write the scene data to a JSON file in the current working directory
with open(output_file, 'w') as json_file:
    json.dump(scenes, json_file, indent=4)

print(f"Scenes data has been saved to {output_file}")
