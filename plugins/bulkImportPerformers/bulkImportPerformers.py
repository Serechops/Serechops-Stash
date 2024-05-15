import requests
import json
import os
import stashapi.log as logger
from config import config  # Importing config from config.py

def graphql_request(query, variables=None):
    headers = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "ApiKey": config["api_key"]
    }
    response = requests.post(config['endpoint'], json={'query': query, 'variables': variables}, headers=headers)
    try:
        data = response.json()
        if "errors" in data:
            logger.error(f"GraphQL errors: {data['errors']}")
        return data.get('data')
    except json.JSONDecodeError:
        logger.error(f"Failed to decode JSON from response: {response.text}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return None

def read_performer_names(file_path):
    try:
        with open(file_path, 'r') as file:
            names = [line.strip() for line in file.readlines()]
        return names
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        return []
    except Exception as e:
        logger.error(f"Error reading file {file_path}: {str(e)}")
        return []

def find_performer(name):
    query = """
    query FindPerformers($name: String!) {
        findPerformers(
            performer_filter: { name: { value: $name, modifier: EQUALS } }
        ) {
            performers {
                id
                name
            }
        }
    }
    """
    variables = {"name": name}
    result = graphql_request(query, variables)
    if result and result.get("findPerformers"):
        performers = result["findPerformers"].get("performers", [])
        if performers:
            return performers[0]
    return None

def create_performer(name):
    existing_performer = find_performer(name)
    if existing_performer:
        return existing_performer

    mutation = """
    mutation PerformerCreate($name: String!) {
        performerCreate(input: { name: $name }) {
            id
            name
        }
    }
    """
    variables = {"name": name}
    result = graphql_request(mutation, variables)
    if result is None:
        logger.error(f"Failed to get a valid response from GraphQL request for performer: {name}")
    return result

def main():
    # Set the working directory to the script's location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    performer_file = "performers.txt"
    performer_names = read_performer_names(performer_file)
    
    if not performer_names:
        logger.error("No performer names to process.")
        return

    logger.info(f"Creating {len(performer_names)} performers...")
    for name in performer_names:
        result = create_performer(name)
        if result:
            if "performerCreate" in result:
                performer = result["performerCreate"]
                logger.info(f"Created performer: {performer['name']} with ID: {performer['id']}")
            elif "id" in result and "name" in result:
                logger.info(f"Performer already exists: {result['name']} with ID: {result['id']}")
        else:
            logger.error(f"Failed to create performer: {name}")

if __name__ == "__main__":
    main()
