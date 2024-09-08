import requests
from bs4 import BeautifulSoup
import json
import os

# Define the base URL for Digital Playground
base_url = "https://www.digitalplayground.com"

# Define the URL for the Digital Playground scenes page
url = "https://www.digitalplayground.com/scenes"

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
scene_containers = soup.find_all("div", class_="one-list-1nib8f7")

scenes = []

# Loop through each scene container and extract the relevant information
for container in scene_containers:
    try:
        # Extract the scene title and link
        link_tag = container.find("a", class_="e1qkfw3j3")
        title = link_tag.get("title") if link_tag else "Unknown Title"
        scene_link = base_url + link_tag.get("href") if link_tag else "#"

        # Extract the thumbnail image
        img_tag = container.find("img", class_="one-list-q4dzvk")
        image_url = img_tag.get("src") if img_tag else ""

        # Extract performers' names
        performer_tags = container.find_all("a", class_="one-list-hueuj4")
        performers = [performer.text.strip() for performer in performer_tags] if performer_tags else ["Unknown Performers"]

        # Extract the release date (assuming it's in a similar format to other sites; otherwise this might need adjustment)
        date_tag = container.find("div", class_="one-list-1149dqe")
        release_date = date_tag.text.strip() if date_tag else "Unknown Date"

        # Store the scene info in a dictionary
        scenes.append({
            "title": title,
            "link": scene_link,
            "image": image_url,
            "performers": performers,
            "date": release_date
        })

    except Exception as e:
        print(f"Error processing scene: {e}")
        continue

# Get the current working directory
current_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(current_dir, 'digitalplayground_scenes.json')

# Write the scene data to a JSON file in the current working directory
with open(output_file, 'w') as json_file:
    json.dump(scenes, json_file, indent=4)

print(f"Scenes data has been saved to {output_file}")
