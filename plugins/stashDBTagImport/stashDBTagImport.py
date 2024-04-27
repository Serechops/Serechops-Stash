import os
import json
import requests
import stashapi.log as log

def create_tags_from_json(json_file, graphql_url):
    log.info("Starting tag creation process...")
    script_dir = os.path.dirname(os.path.realpath(__file__))  # Get the directory of the script
    json_file_path = os.path.join(script_dir, json_file)      # Create the absolute path to the JSON file
    
    with open(json_file_path, 'r') as file:
        data = json.load(file)

    mutation = """
    mutation TagCreate($name: String!, $description: String!) {
        tagCreate(input: { name: $name, description: $description }) {
            id
        }
    }
    """

    total_tags = len(data)  # Count the total number of tags

    for index, item in enumerate(data, 1):
        tag = item['Tag']
        description = item['Description']
        variables = {'name': tag, 'description': description}

        response = requests.post(graphql_url, json={'query': mutation, 'variables': variables})

        if response.status_code == 200:
            log.info(f"[{index}/{total_tags}] Tag '{tag}' created successfully.")
        else:
            log.warning(f"Failed to create tag '{tag}'. Error: {response.text}")

    log.info(f"Tag creation process completed. Total tags imported: {total_tags}.")

if __name__ == "__main__":
    json_file = "stashDB_tags.json"  # Change this to your JSON file name
    graphql_url = "http://localhost:9999/graphql"  # Change this to your GraphQL endpoint
    create_tags_from_json(json_file, graphql_url)
