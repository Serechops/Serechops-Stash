import requests
import json
import re
import stashapi.log as log

# Define the GraphQL endpoint
graphql_url = "http://localhost:9999/graphql"

# Query to get all scenes with their markers and details
query = """
query AllScenes {
    allScenes {
        id
        title
        details
        scene_markers {
            seconds
            primary_tag {
                name
            }
        }
    }
}
"""

# Mutation to update scene details
mutation = """
mutation SceneUpdate($scene_id: ID!, $timestamps: String!) {
    sceneUpdate(input: { id: $scene_id, details: $timestamps}) {
        id
    }
}
"""

# Function to convert seconds to YouTube timestamp format
def convert_seconds_to_timestamp(seconds):
    # Properly round the seconds and handle formatting
    seconds = round(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    seconds = seconds % 60
    if hours > 0:
        return f"{hours}:{minutes:02}:{seconds:02}"
    else:
        return f"{minutes}:{seconds:02}"

# Function to send GraphQL requests
def graphql_request(query, variables=None):
    response = requests.post(graphql_url, json={'query': query, 'variables': variables})
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Query failed to run by returning code of {response.status_code}. {query}")

# Function to remove YouTube-style timestamps and additional patterns from the details
def remove_timestamps(details):
    # Regex to match lines that start with:
    # - a timestamp (HH:MM:SS or MM:SS) followed by " - " and a word
    # - a number followed by " Description"
    timestamp_regex = re.compile(r'^\d{1,2}:\d{2}(?::\d{2})? - \w+|^\d+(\.\d+)? Description$', re.MULTILINE)
    return re.sub(timestamp_regex, '', details).strip()

# Fetch all scenes
log.info("Fetching all scenes with their markers and details.")
result = graphql_request(query)

if 'errors' in result:
    log.error(f"Errors: {result['errors']}")
else:
    scenes = result['data']['allScenes']
    log.info(f"Fetched {len(scenes)} scenes.")

    total_scenes = len(scenes)

    # Iterate through scenes and update details with timestamps if they have markers
    for index, scene in enumerate(scenes):
        scene_id = scene['id']
        markers = scene['scene_markers']
        title = scene['title']
        existing_details = scene['details'] if scene['details'] else ""
        
        if "Timestamps" in existing_details:
            log.info(f"Scene '{title}' with ID {scene_id} already has timestamps. Skipping.")
            continue
        
        if markers:
            log.info(f"Processing scene '{title}' with ID {scene_id} containing {len(markers)} markers.")
            timestamps = []
            for marker in sorted(markers, key=lambda x: x['seconds']):
                timestamp = convert_seconds_to_timestamp(marker['seconds'])
                label = marker['primary_tag']['name'] if marker['primary_tag'] else "No Tag"
                timestamps.append(f"{timestamp} - {label}")
            
            # Create details string in YouTube format
            new_details = "\n".join(timestamps)
            
            # Append new timestamps to existing details with a line break and heading
            updated_details = f"{existing_details}\n\nTimestamps\n{new_details}".strip()
            
            # Prepare variables for the mutation
            variables = {
                "scene_id": scene_id,
                "timestamps": updated_details
            }
            
            # Update the scene details
            update_result = graphql_request(mutation, variables)
            if 'errors' in update_result:
                log.error(f"Failed to update scene {scene_id}: {update_result['errors']}")
            else:
                log.info(f"Successfully updated scene '{title}' with ID {scene_id}.")

        # Update progress
        progress = (index + 1) / total_scenes
        log.progress(progress)

# To remove the timestamps and the heading:
def remove_timestamps_section(details):
    # Match everything after the "Timestamps" heading
    timestamps_section_regex = re.compile(r'\n\nTimestamps\n.*', re.DOTALL)
    return re.sub(timestamps_section_regex, '', details).strip()

# Example usage for removing timestamps:
for index, scene in enumerate(scenes):
    scene_id = scene['id']
    existing_details = scene['details'] if scene['details'] else ""
    
    if "Timestamps" in existing_details:
        log.info(f"Removing timestamps from scene '{scene['title']}' with ID {scene_id}.")
        updated_details = remove_timestamps_section(existing_details)
        
        # Prepare variables for the mutation
        variables = {
            "scene_id": scene_id,
            "timestamps": updated_details
        }
        
        # Update the scene details
        update_result = graphql_request(mutation, variables)
        if 'errors' in update_result:
            log.error(f"Failed to update scene {scene_id}: {update_result['errors']}")
        else:
            log.info(f"Successfully updated scene '{scene['title']}' with ID {scene_id}.")

    # Update progress
    progress = (index + 1) / total_scenes
    log.progress(progress)
