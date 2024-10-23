import os
import json
import requests
import stashapi.log as log

def get_all_tags(graphql_url, api_key=None):
    log.info("Fetching existing tags...")
    
    headers = {'Content-Type': 'application/json'}
    if api_key:
        headers['ApiKey'] = api_key

    query = """
    query {
        allTags {
            id
            name
            description
        }
    }
    """
    response = requests.post(graphql_url, json={'query': query}, headers=headers)

    if response.status_code == 200:
        data = response.json()
        tags = data['data']['allTags']  # Extract all tags
        return {tag['name'].lower() for tag in tags}  # Return a set of tag names in lowercase for easy comparison
    else:
        log.error(f"Failed to fetch tags. Error: {response.text}")
        return set()

def create_tags_from_json(json_file, graphql_url, api_key=None):
    log.info("Starting tag creation process...")
    script_dir = os.path.dirname(os.path.realpath(__file__))  # Get the directory of the script
    json_file_path = os.path.join(script_dir, json_file)      # Create the absolute path to the JSON file
    
    with open(json_file_path, 'r') as file:
        data = json.load(file)
    
    # Fetch all existing tags
    existing_tags = get_all_tags(graphql_url, api_key)

    mutation = """
    mutation TagCreate($name: String!, $description: String!) {
        tagCreate(input: { name: $name, description: $description }) {
            id
        }
    }
    """

    headers = {'Content-Type': 'application/json'}
    if api_key:
        headers['ApiKey'] = api_key

    total_tags = len(data)  # Count the total number of tags
    created_count = 0  # To track the number of new tags created

    for index, item in enumerate(data, 1):
        tag = item['Tag']
        description = item['Description']
        
        # Check if the tag already exists (case-insensitive check)
        if tag.lower() in existing_tags:
            log.info(f"Tag '{tag}' already exists. Skipping...")
            continue
        
        variables = {'name': tag, 'description': description}
        response = requests.post(graphql_url, json={'query': mutation, 'variables': variables}, headers=headers)

        if response.status_code == 200:
            log.info(f"[{index}/{total_tags}] Tag '{tag}' created successfully.")
        else:
            log.warning(f"Failed to create tag '{tag}'. Error: {response.text}")

    log.info(f"Tag creation process completed. Total tags imported: {total_tags}, Tags created: {created_count}.")

if __name__ == "__main__":
    json_file = "stashDB_tags.json"  # Change this to your JSON file name
    graphql_url = "http://localhost:9999/graphql"  # Change this to your GraphQL endpoint
    api_key = ""  # Change this to your API key if needed or leave None
    create_tags_from_json(json_file, graphql_url, api_key)
