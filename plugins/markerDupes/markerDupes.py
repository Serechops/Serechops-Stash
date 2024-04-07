import requests
import json

# Endpoint for your GraphQL API
GRAPHQL_ENDPOINT = 'http://localhost:9999/graphql'

# Headers, including authentication if needed
HEADERS = {
    'Content-Type': 'application/json',
    # Add any authentication token if required
    # 'Authorization': 'Bearer YOUR_ACCESS_TOKEN',
}

# Perform the query to get all scene markers
def fetch_scene_markers():
    query = """
    query AllSceneMarkers {
        allSceneMarkers {
            id
            title
            seconds
            scene {
                id
            }
        }
    }
    """
    response = requests.post(GRAPHQL_ENDPOINT, json={'query': query}, headers=HEADERS)
    if response.status_code == 200:
        return response.json()['data']['allSceneMarkers']
    else:
        raise Exception("Query failed to run by returning code of {}. {}".format(response.status_code, query))

# Destroy duplicate markers
def destroy_marker(duplicate_marker_id):
    mutation = """
    mutation SceneMarkerDestroy($id: ID!) {
        sceneMarkerDestroy(id: $id)
    }
    """
    variables = {
        'id': duplicate_marker_id,
    }
    response = requests.post(GRAPHQL_ENDPOINT, json={'query': mutation, 'variables': variables}, headers=HEADERS)
    if response.status_code == 200:
        print(f"Duplicate marker {duplicate_marker_id} destroyed successfully.")
    else:
        print(f"Failed to destroy marker {duplicate_marker_id}. Response code: {response.status_code}")

# Main function to find and destroy duplicates
def main():
    markers = fetch_scene_markers()
    seen = {}
    duplicates = []

    # Check for duplicates
    for marker in markers:
        identifier = (marker['scene']['id'], marker['seconds'], marker['title'])
        if identifier in seen:
            duplicates.append(marker['id'])
        else:
            seen[identifier] = marker['id']

    # Destroy duplicates
    for duplicate_id in duplicates:
        destroy_marker(duplicate_id)

if __name__ == "__main__":
    main()
