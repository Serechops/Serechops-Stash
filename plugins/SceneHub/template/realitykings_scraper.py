import requests
from bs4 import BeautifulSoup
import json
import os
import time

# Define the URL for Reality Kings scenes page
url = "https://www.rk.com/scenes"

# Send a GET request to fetch the page content
response = requests.get(url)
soup = BeautifulSoup(response.content, "html.parser")

# Find all scene cards by their class name
scene_cards = soup.find_all("div", class_="one-list-1f5zrp6")

scenes = []

# Loop through each scene card and extract the relevant information
for card in scene_cards:
    # Extract the scene title and link
    title_tag = card.find("a", class_="e1qkfw3j3")
    title = title_tag["title"] if title_tag else "Unknown Title"
    scene_link = "https://www.rk.com" + title_tag["href"] if title_tag else "#"

    # Extract the thumbnail image
    image_tag = card.find("img", class_="one-list-q4dzvk")
    image_url = image_tag["src"] if image_tag else ""

    # Extract performers
    performers_tag = card.find("div", class_="one-list-1c275wv")
    if performers_tag:
        performers = [performer.text.strip() for performer in performers_tag.find_all("a")]
    else:
        performers = ["Unknown Performers"]

    # Store the scene info in a dictionary
    scenes.append({
        "title": title,
        "link": scene_link,
        "image": image_url,
        "performers": performers
    })

    # Optional: sleep to avoid sending too many requests in a short period
    time.sleep(1)

# Get the current working directory
current_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(current_dir, 'realitykings_scenes.json')

# Write the scene data to a JSON file in the current working directory
with open(output_file, 'w') as json_file:
    json.dump(scenes, json_file, indent=4)

print(f"Scenes data has been saved to {output_file}")
