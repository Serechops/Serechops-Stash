import requests
import time
import stashapi.log as log

# GraphQL endpoint URL
endpoint_url = "http://localhost:9999/graphql"

# GraphQL query to retrieve all tags
all_tags_query = """
query AllTags {
    allTags {
        id
        name
        image_path
    }
}
"""

# GraphQL query to find scene markers by tag name
find_scene_markers_query = """
query FindSceneMarkers($tag_name: String!) {
    findSceneMarkers(filter: { q: $tag_name, per_page: -1 }) {
        scene_markers {
            id
            preview
        }
    }
}
"""

# GraphQL mutation to update tag image
tag_update_mutation = """
mutation TagUpdate {
    tagUpdate(input: { id: $tag_id, image: "$preview" }) {
        id
    }
}
"""

def fetch_graphql_data(query, variables=None):
    try:
        response = requests.post(endpoint_url, json={'query': query, 'variables': variables})
        response.raise_for_status()  # Raise an exception for non-2xx responses
        return response.json()
    except Exception as e:
        log.error(f"Error fetching GraphQL data: {e}")
        return None

def update_tag_image(tag_id, preview):
    variables = {"tag_id": tag_id, "preview": preview}
    mutation = tag_update_mutation.replace("$tag_id", tag_id).replace("$preview", preview)
    try:
        response = requests.post(endpoint_url, json={'query': mutation, 'variables': variables})
        response.raise_for_status()  # Raise an exception for non-2xx responses
        return response.json()
    except Exception as e:
        log.error(f"Error updating tag image: {e}")
        return None

def calculate_eta(total_tags, total_markers, current_tag_index, current_marker_index, start_time):
    tags_remaining = total_tags - current_tag_index
    markers_remaining = total_markers - current_marker_index
    total_remaining = tags_remaining + markers_remaining
    elapsed_time = time.time() - start_time
    if total_remaining == 0:
        return 0
    avg_time_per_item = elapsed_time / (total_tags + total_markers)
    eta = avg_time_per_item * total_remaining
    return int(eta)

def main():
    # Initialize a set to store used scene marker preview URLs
    used_urls = set()

    # Fetch all tags
    tags_data = fetch_graphql_data(all_tags_query)
    if not tags_data:
        return
    
    tags = tags_data.get("data", {}).get("allTags", [])
    total_tags = len(tags)
    total_markers = 0

    # Determine total number of markers
    for tag in tags:
        tag_name = tag.get("name")
        scene_markers_data = fetch_graphql_data(find_scene_markers_query, variables={"tag_name": tag_name})
        if scene_markers_data:
            scene_markers = scene_markers_data.get("data", {}).get("findSceneMarkers", {}).get("scene_markers", [])
            total_markers += len(scene_markers)

    # Initialize progress variables
    processed_tags = 0
    processed_markers = 0

    # Loop through tags
    for tag_index, tag in enumerate(tags, 1):
        tag_id = tag.get("id")
        tag_name = tag.get("name")
        tag_image_path = tag.get("image_path")

        # Search for scene markers by tag name
        scene_markers_data = fetch_graphql_data(find_scene_markers_query, variables={"tag_name": tag_name})
        if scene_markers_data:
            scene_markers = scene_markers_data.get("data", {}).get("findSceneMarkers", {}).get("scene_markers", [])

            # Find a unique scene marker preview URL
            unique_url = None
            for marker in scene_markers:
                if marker.get("preview") not in used_urls:
                    unique_url = marker.get("preview")
                    used_urls.add(unique_url)
                    break

            # Update tag image if a unique scene marker preview URL is found
            if unique_url:
                if tag_image_path != unique_url:
                    update_tag_image(tag_id, unique_url)
                    log.info(f"Updated tag '{tag_name}' with scene marker preview.")
                    processed_markers += 1
                    time.sleep(0.5)  # Add a half-second delay
                else:
                    log.info(f"Tag '{tag_name}' already has the correct preview.")
            else:
                log.info(f"No unique scene marker preview URL available for tag '{tag_name}'. Skipping.")

        processed_tags += 1

        # Calculate progress as a percentage and log it
        progress = processed_tags / total_tags
        log.progress(progress)

        # Calculate and log ETA
        eta = calculate_eta(total_tags, total_markers, processed_tags, processed_markers, start_time)
        log.info(f"Progress: {progress * 100:.2f}%, ETA: {eta} seconds.")

if __name__ == "__main__":
    log.info("Starting script...")
    start_time = time.time()  # Initialize start time
    main()


if __name__ == "__main__":
    log.info("Starting script...")
    start_time = time.time()  # Initialize start time
    main()

