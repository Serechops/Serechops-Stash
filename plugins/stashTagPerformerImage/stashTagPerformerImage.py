import requests
import json
import sys
import logging
from pathlib import Path
import stashapi.log as log

# Configure external logger
external_logger = logging.getLogger('external_logger')
external_logger.setLevel(logging.DEBUG)
log_handler = logging.FileHandler('/config/external_debug.log')
log_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
log_handler.setFormatter(log_formatter)
external_logger.addHandler(log_handler)

def graphql_request(session, api_url, query, variables=None):
    headers = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    response = session.post(api_url, json={'query': query, 'variables': variables}, headers=headers)
    
    log.debug(f"GraphQL request to {api_url} with query: {query} and variables: {variables}")
    external_logger.debug(f"GraphQL request to {api_url} with query: {query} and variables: {variables}")
    
    if response.status_code != 200:
        log.error(f"GraphQL request failed with status code: {response.status_code} and response: {response.text}")
        external_logger.error(f"GraphQL request failed with status code: {response.status_code} and response: {response.text}")
        return None
    
    try:
        data = response.json()
        log.debug(f"GraphQL response: {json.dumps(data, indent=2)}")
        external_logger.debug(f"GraphQL response: {json.dumps(data, indent=2)}")
        return data.get('data')
    except json.JSONDecodeError:
        log.error(f"Failed to decode JSON from response: {response.text}")
        external_logger.error(f"Failed to decode JSON from response: {response.text}")
        return None

def get_hook_context():
    try:
        json_input = json.loads(sys.stdin.read())
        hook_context = json_input.get('args', {}).get('hookContext', {})
        server_connection = json_input.get('server_connection', {})
        log.debug(f"Hook context: {hook_context}")
        log.debug(f"Server connection: {server_connection}")
        external_logger.debug(f"Hook context: {hook_context}")
        external_logger.debug(f"Server connection: {server_connection}")
        return hook_context, server_connection
    except json.JSONDecodeError:
        log.error("Failed to decode JSON input.")
        external_logger.error("Failed to decode JSON input.")
        return {}, {}

def find_image(session, api_url, image_id):
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
    return graphql_request(session, api_url, query_find_image, variables)

def find_performers(session, api_url, parent_path):
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
    return graphql_request(session, api_url, query_find_performers, variables)

def update_image(session, api_url, image_id, performer_id):
    mutation_image_update = """
    mutation ImageUpdate($image_id: ID!, $performer_id: [ID!]) {
        imageUpdate(input: { id: $image_id, performer_ids: $performer_id }) {
            id
            title
        }
    }
    """
    variables = {"image_id": image_id, "performer_id": [performer_id]}
    return graphql_request(session, api_url, mutation_image_update, variables)

def main():
    hook_context, server_connection = get_hook_context()
    if not hook_context:
        log.error("No hook context provided.")
        external_logger.error("No hook context provided.")
        return

    image_id = hook_context.get('id')
    if not image_id:
        log.error("No image ID provided in the hook context.")
        external_logger.error("No image ID provided in the hook context.")
        return

    scheme = server_connection.get('Scheme')
    host = server_connection.get('Host')
    port = server_connection.get('Port')
    session_cookie = server_connection.get('SessionCookie', {})
    api_key = session_cookie.get('Value')
    
    log.debug(f"Scheme: {scheme}")
    log.debug(f"Host: {host}")
    log.debug(f"Port: {port}")
    log.debug(f"SessionCookie: {session_cookie}")
    log.debug(f"API Key: {api_key}")
    
    external_logger.debug(f"Scheme: {scheme}")
    external_logger.debug(f"Host: {host}")
    external_logger.debug(f"Port: {port}")
    external_logger.debug(f"SessionCookie: {session_cookie}")
    external_logger.debug(f"API Key: {api_key}")

    if not scheme or not host or not port or not api_key:
        log.error(f"Server connection details: {server_connection}")
        log.error("Incomplete server connection details provided.")
        external_logger.error(f"Server connection details: {server_connection}")
        external_logger.error("Incomplete server connection details provided.")
        return

    # If the host is 0.0.0.0, set it to localhost
    if host == '0.0.0.0':
        log.info("Host is set to 0.0.0.0, changing it to 'localhost'.")
        external_logger.info("Host is set to 0.0.0.0, changing it to 'localhost'.")
        host = 'localhost'

    api_url = f"{scheme}://{host}:{port}/graphql"

    session = requests.Session()
    session.cookies.set(session_cookie['Name'], api_key)

    log.info(f"Processing image ID: {image_id}")
    external_logger.info(f"Processing image ID: {image_id}")

    image_data = find_image(session, api_url, image_id)
    if not image_data or not image_data.get('findImage'):
        log.error(f"Failed to fetch details for image ID: {image_id}")
        external_logger.error(f"Failed to fetch details for image ID: {image_id}")
        return

    image_info = image_data['findImage']
    if not image_info.get('files'):
        log.error(f"No files found for image ID: {image_id}")
        external_logger.error(f"No files found for image ID: {image_id}")
        return

    image_path = image_info['files'][0]['path']
    parent_directory = Path(image_path).parent.name

    log.info(f"Parent directory of the image: {parent_directory}")
    external_logger.info(f"Parent directory of the image: {parent_directory}")

    performers_data = find_performers(session, api_url, parent_directory)
    if not performers_data or not performers_data.get('findPerformers'):
        log.info(f"No performers found matching the directory name: {parent_directory}")
        external_logger.info(f"No performers found matching the directory name: {parent_directory}")
        return

    performers = performers_data['findPerformers']['performers']
    if not performers:
        log.info(f"No performers found matching the directory name: {parent_directory}")
        external_logger.info(f"No performers found matching the directory name: {parent_directory}")
        return

    performer_id = performers[0]['id']  # Assuming the first match is the correct one
    update_response = update_image(session, api_url, image_id, performer_id)
    if update_response:
        log.info(f"Image ID {image_id} successfully updated with performer ID {performer_id}.")
        external_logger.info(f"Image ID {image_id} successfully updated with performer ID {performer_id}.")
    else:
        log.error(f"Failed to update image ID {image_id} with performer ID {performer_id}.")
        external_logger.error(f"Failed to update image ID {image_id} with performer ID {performer_id}.")

if __name__ == '__main__':
    main()
