import requests
import json
import sys
import stashapi.log as log
from pathlib import Path

# Configuration
API_ENDPOINT = "http://localhost:9999/graphql"
API_KEY = ""  # Add your API key if required

def graphql_request(query, variables=None):
    headers = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "ApiKey": API_KEY
    }
    response = requests.post(API_ENDPOINT, json={'query': query, 'variables': variables}, headers=headers)
    try:
        data = response.json()
        return data.get('data')
    except json.JSONDecodeError:
        log.error(f"Failed to decode JSON from response: {response.text}")
        return None

def get_hook_context():
    try:
        json_input = json.loads(sys.stdin.read())
        hook_context = json_input.get('args', {}).get('hookContext', {})
        return hook_context
    except json.JSONDecodeError:
        log.error("Failed to decode JSON input.")
        return {}

def find_image(image_id):
    query_find_image = """
    query FindImage($id: ID!) {
        findImage(id: $id) {
            id
            files {
                path
            }
        }
    }
    """
    variables = {"id": image_id}
    return graphql_request(query_find_image, variables)

def find_performers(parent_path):
    query_find_performers = """
    query FindPerformers($parent_path: String!) {
        findPerformers(
            performer_filter: { name: { value: $parent_path, modifier: EQUALS } }
        ) {
            performers {
                id
                name
            }
        }
    }
    """
    variables = {"parent_path": parent_path}
    return graphql_request(query_find_performers, variables)

def update_image(image_id, performer_id):
    mutation_image_update = """
    mutation ImageUpdate($image_id: ID!, $performer_id: [ID!]) {
        imageUpdate(input: { id: $image_id, performer_ids: $performer_id }) {
            id
            title
        }
    }
    """
    variables = {"image_id": image_id, "performer_id": [performer_id]}
    return graphql_request(mutation_image_update, variables)

def main():
    hook_context = get_hook_context()
    if not hook_context:
        log.error("No hook context provided.")
        return

    image_id = hook_context.get('id')
    if not image_id:
        log.error("No image ID provided in the hook context.")
        return

    log.info(f"Processing image ID: {image_id}")

    image_data = find_image(image_id)
    if not image_data or not image_data.get('findImage'):
        log.error(f"Failed to fetch details for image ID: {image_id}")
        return

    image_info = image_data['findImage']
    if not image_info.get('files'):
        log.error(f"No files found for image ID: {image_id}")
        return

    image_path = image_info['files'][0]['path']
    parent_directory = Path(image_path).parent.name

    log.info(f"Parent directory of the image: {parent_directory}")

    performers_data = find_performers(parent_directory)
    if not performers_data or not performers_data.get('findPerformers'):
        log.info(f"No performers found matching the directory name: {parent_directory}")
        return

    performers = performers_data['findPerformers']['performers']
    if not performers:
        log.info(f"No performers found matching the directory name: {parent_directory}")
        return

    performer_id = performers[0]['id']  # Assuming the first match is the correct one
    update_response = update_image(image_id, performer_id)
    if update_response:
        log.info(f"Image ID {image_id} successfully updated with performer ID {performer_id}.")
    else:
        log.error(f"Failed to update image ID {image_id} with performer ID {performer_id}.")

if __name__ == '__main__':
    main()
