import os
import requests
import stashapi.log as log # Using stashapi log for structured logging
from stashapi.stashapp import StashInterface
import json
import sys

# Constants
TARGET_GRAPHQL_URL = "http://localhost:9999/graphql" # Default target GraphQL endpoint
PER_PAGE = 25 # Number of tags per page as per StashDB's pagination


def get_stash_connection_info():
    """
    Retrieves the Stash server connection details and the local API key.

    Returns:
        tuple: (stashdb_endpoint, stashdb_api_key, local_api_key) if successful, with None for missing keys.
    """
    try:
        # Parse the server connection details from stdin
        json_input = json.loads(sys.stdin.read())
        FRAGMENT_SERVER = json_input.get("server_connection")

        # Initialize StashInterface
        stash = StashInterface(FRAGMENT_SERVER)
        stash_config = stash.get_configuration()

        # Extract StashBox connection info (StashDB)
        stash_boxes = stash_config.get("general", {}).get("stashBoxes", [])
        if not stash_boxes:
            log.error("No stashBoxes found in the configuration.")
            return None, None, None

        # Assuming the first stashBox is the target for StashDB
        stashdb_info = stash_boxes[0]
        stashdb_endpoint = stashdb_info.get("endpoint")
        stashdb_api_key = stashdb_info.get("api_key")

        if not stashdb_endpoint:
            log.error("StashDB endpoint not found in configuration.")
            return None, None, None

        log.info(f"Retrieved StashDB endpoint: {stashdb_endpoint}")
        if stashdb_api_key:
            log.info(f"Retrieved StashDB API Key: {stashdb_api_key[:6]}... (hidden for security)")
        else:
            log.warning("No StashDB API Key found in configuration.")

        # Retrieve Local API Key
        local_api_key = stash_config.get("general", {}).get("apiKey")
        if not local_api_key:
            log.warning("Local API Key not found in the configuration. Proceeding without it.")

        return stashdb_endpoint, stashdb_api_key, local_api_key
    except Exception as e:
        log.error(f"Error retrieving Stash connection info: {e}")
        return None, None, None


def fetch_all_stashdb_tags(stashdb_endpoint, api_key=None):
    """
    Fetch all tags from StashDB with pagination.
    Returns a list of tag dictionaries.
    """
    log.info("Fetching tags from StashDB...")
    all_tags = []
    page = 1
    total_pages = 1 # Initialize to enter the loop

    query = """
    query QueryTags($per_page: Int!, $page: Int!) {
        queryTags(input: { per_page: $per_page, page: $page }) {
            count
            tags {
                id
                name
                description
                aliases
                deleted
                created
                updated
                category {
                    id
                    name
                    group
                    description
                }
            }
        }
    }
    """

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["ApiKey"] = api_key

    while page <= total_pages:
        variables = {"per_page": PER_PAGE, "page": page}
        try:
            response = requests.post(
                stashdb_endpoint,
                json={"query": query, "variables": variables},
                headers=headers,
            )
            if response.status_code == 200:
                data = response.json()
                tag_data = data.get("data", {}).get("queryTags", {})
                tags = tag_data.get("tags", [])
                all_tags.extend(tags)

                # Calculate total pages based on count
                if page == 1:
                    total_count = tag_data.get("count", 0)
                    total_pages = (total_count + PER_PAGE - 1) // PER_PAGE # Ceiling division
                    log.info(f"Total tags to fetch: {total_count} across {total_pages} pages.")

                log.progress(page / total_pages) # Update progress
                page += 1
            else:
                log.error(f"Failed to fetch tags from StashDB. HTTP {response.status_code}: {response.text}")
                break
        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching tags from StashDB: {e}")
            break

    log.info(f"Completed fetching tags from StashDB. Total tags fetched: {len(all_tags)}.")
    return all_tags


def get_existing_tags(target_graphql_url, local_api_key=None):
    """
    Fetch existing tags (ID, Name, and Aliases) from the target system.
    Returns a dictionary mapping lowercase tag name OR alias to {id, name}.
    This is crucial for detecting conflicts where a StashDB name is a local alias.
    """
    log.info("Fetching existing tags (including aliases) from the target system...")

    headers = {"Content-Type": "application/json"}
    if local_api_key:
        headers["ApiKey"] = local_api_key

    # Query for all tags, including their ID and Aliases
    query = """
    query {
        allTags {
            id
            name
            aliases  # <-- Included aliases to check for conflicts
        }
    }
    """
    try:
        response = requests.post(target_graphql_url, json={"query": query}, headers=headers)
        if response.status_code == 200:
            data = response.json()
            tags = data.get("data", {}).get("allTags", [])
            
            # Map: lowercase_name_or_alias -> {id, name}
            existing_tag_map = {}
            for tag in tags:
                tag_id = tag["id"]
                tag_name = tag["name"]
                
                # 1. Map the primary name
                existing_tag_map[tag_name.lower()] = {"id": tag_id, "name": tag_name}
                
                # 2. Map all aliases to the same tag ID
                for alias in tag.get("aliases", []):
                    # Only map the alias if it hasn't already been mapped as a primary name
                    if alias.lower() not in existing_tag_map:
                        existing_tag_map[alias.lower()] = {"id": tag_id, "name": tag_name} 

            log.info(f"Existing names and aliases mapped: {len(existing_tag_map)}.")
            return existing_tag_map
        else:
            log.error(f"Failed to fetch existing tags. HTTP {response.status_code}: {response.text}")
            return {}
    except requests.exceptions.RequestException as e:
        log.error(f"Error fetching existing tags: {e}")
        return {}


def create_tags_in_target(tags, target_graphql_url, local_api_key=None):
    """
    Create new tags in the target system using the TagCreate mutation.
    """
    log.info("Starting tag creation process in the target system...")

    mutation = """
    mutation TagCreate($input: TagCreateInput!) {
        tagCreate(input: $input) {
            id
            name
            description
            aliases
        }
    }
    """

    headers = {"Content-Type": "application/json"}
    if local_api_key:
        headers["ApiKey"] = local_api_key

    total_tags = len(tags)
    created_count = 0

    for index, tag in enumerate(tags, 1):
        tag_name = tag["name"]
        description = tag.get("description", "")
        aliases = tag.get("aliases", [])

        input_data = {
            "name": tag_name,
            "description": description,
            "aliases": aliases,
        }

        variables = {"input": input_data}
        try:
            response = requests.post(
                target_graphql_url,
                json={"query": mutation, "variables": variables},
                headers=headers,
            )
            if response.status_code == 200:
                result = response.json()
                if "errors" in result:
                    log.warning(f"[{index}/{total_tags}] Failed to create tag '{tag_name}'. Errors: {result['errors']}")
                else:
                    created_count += 1
                    log.info(f"[{index}/{total_tags}] Tag '{tag_name}' created successfully.")
            else:
                log.warning(f"[{index}/{total_tags}] Failed to create tag '{tag_name}'. HTTP {response.status_code}: {response.text}")
        except requests.exceptions.RequestException as e:
            log.warning(f"[{index}/{total_tags}] Exception while creating tag '{tag_name}': {e}")

        # Progress update
        log.progress(index / total_tags)

    log.info(f"Tag creation process completed. Total tags processed: {total_tags}, Tags created: {created_count}.")


def update_tags_in_target(tags_to_update, target_graphql_url, local_api_key=None):
    """
    Update existing tags in the target system using the TagUpdate mutation,
    updating the alias and description.
    """
    log.info("Starting tag update process in the target system...")

    mutation = """
    mutation TagUpdate($input: TagUpdateInput!) {
        tagUpdate(input: $input) {
            id
            name
            description
            aliases
        }
    }
    """

    headers = {"Content-Type": "application/json"}
    if local_api_key:
        headers["ApiKey"] = local_api_key

    total_tags = len(tags_to_update)
    updated_count = 0

    for index, tag_data in enumerate(tags_to_update, 1):
        stashdb_tag = tag_data["stashdb_tag"]
        existing_info = tag_data["existing_info"]
        tag_name = existing_info["name"] # Use the existing local name for logging
        tag_id = existing_info["id"]

        description = stashdb_tag.get("description", "")
        aliases = stashdb_tag.get("aliases", [])

        input_data = {
            "id": tag_id,
            "description": description,
            # Note: This will OVERWRITE existing aliases with StashDB's aliases.
            "aliases": aliases, 
        }

        variables = {"input": input_data}
        try:
            response = requests.post(
                target_graphql_url,
                json={"query": mutation, "variables": variables},
                headers=headers,
            )
            if response.status_code == 200:
                result = response.json()
                if "errors" in result:
                    log.warning(f"[{index}/{total_tags}] Failed to update tag '{tag_name}' (ID: {tag_id}). Errors: {result['errors']}")
                else:
                    updated_count += 1
                    # Log the name that triggered the update (which might be an alias)
                    log.info(f"[{index}/{total_tags}] Local tag '{tag_name}' (via StashDB tag '{stashdb_tag['name']}') updated successfully.")
            else:
                log.warning(f"[{index}/{total_tags}] Failed to update tag '{tag_name}' (ID: {tag_id}). HTTP {response.status_code}: {response.text}")
        except requests.exceptions.RequestException as e:
            log.warning(f"[{index}/{total_tags}] Exception while updating tag '{tag_name}' (ID: {tag_id}): {e}")

        # Progress update
        log.progress(index / total_tags)

    log.info(f"Tag update process completed. Total tags processed: {total_tags}, Tags updated: {updated_count}.")


def main():
    # Step 1: Retrieve StashDB and local connection info
    stashdb_endpoint, stashdb_api_key, local_api_key = get_stash_connection_info()
    if not stashdb_endpoint:
        log.error("Unable to retrieve necessary connection information. Exiting.")
        return

    # Step 2: Fetch all tags from StashDB
    stashdb_tags = fetch_all_stashdb_tags(stashdb_endpoint, stashdb_api_key)

    if not stashdb_tags:
        log.error("No tags fetched from StashDB. Exiting.")
        return

    # Step 3: Fetch existing tags (name, id, and aliases) from the target system
    # existing_tags_map: {lowercase_name_or_alias: {id: <tag_id>, name: <tag_name>}}
    existing_tags_map = get_existing_tags(TARGET_GRAPHQL_URL, local_api_key)

    # Step 4: Separate tags into new (create) and existing (update) lists
    new_tags = []
    tags_to_update = []

    for tag in stashdb_tags:
        tag_name_lower = tag["name"].lower()
        if tag_name_lower in existing_tags_map:
            # Tag exists, prepare for update
            tags_to_update.append({
                "stashdb_tag": tag,
                "existing_info": existing_tags_map[tag_name_lower]
            })
        else:
            # Tag is new, prepare for creation
            new_tags.append(tag)

    log.info(f"Tags to be updated: {len(tags_to_update)}.")
    log.info(f"New tags to be created: {len(new_tags)}.")

    if not tags_to_update and not new_tags:
        log.info("No tags to create or update. Exiting.")
        return

    # Step 5: Update existing tags in the target system
    if tags_to_update:
        update_tags_in_target(tags_to_update, TARGET_GRAPHQL_URL, local_api_key)

    # Step 6: Create new tags in the target system
    if new_tags:
        create_tags_in_target(new_tags, TARGET_GRAPHQL_URL, local_api_key)


if __name__ == "__main__":
    main()
