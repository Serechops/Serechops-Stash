#!/usr/bin/env python3

import sys
import json
import asyncio
import traceback
import os
import stashapi.log as log
from gql import gql, Client
from gql.transport.aiohttp import AIOHTTPTransport

# Configuration Constants
DEFAULT_GRAPHQL_URL = "http://localhost:9999/graphql"  # Default GraphQL endpoint
PLUGIN_ID = "stashDynamicGroups"
REQUEST_TIMEOUT = 60  # Set a timeout for GraphQL requests

# Determine the script's directory and set the tag state file path
SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
TAG_STATE_FILE = os.path.join(SCRIPT_DIR, "scene_tags.json")


async def is_scene_in_group(client, scene_id, group_id):
    """
    Check if a scene is already in the group using the `findGroup` query.
    """
    query = gql("""
        query FindGroup($group_id: ID!) {
            findGroup(id: $group_id) {
                scenes {
                    id
                }
            }
        }
    """)
    variables = {"group_id": group_id}
    try:
        response = await client.execute_async(query, variable_values=variables)
        group_scenes = response.get("findGroup", {}).get("scenes", [])
        group_scene_ids = [str(scene["id"]) for scene in group_scenes]
        in_group = str(scene_id) in group_scene_ids

        return in_group
    except Exception as e:
        log.error(f"Error checking if scene {scene_id} is in group {group_id}: {e}")
        return False


async def add_scene_to_group(client, scene_id, group_id):
    """
    Add a scene to a group.
    """
    mutation = gql("""
        mutation AddSceneToGroup($scene_id: ID!, $group_id: ID!) {
            sceneUpdate(input: { id: $scene_id, groups: [{ group_id: $group_id }] }) {
                id
                groups {
                    group {
                        id
                        name
                    }
                }
            }
        }
    """)
    variables = {"scene_id": scene_id, "group_id": group_id}
    try:
        await client.execute_async(mutation, variable_values=variables)

    except Exception as e:
        log.error(f"Error adding scene {scene_id} to group {group_id}: {e}")
        raise


async def remove_scene_from_group(client, scene_id, group_id):
    """
    Remove a scene from a group.
    """
    mutation = gql("""
        mutation RemoveSceneFromGroup($scene_id: ID!, $group_id: ID!) {
            sceneUpdate(input: { id: $scene_id, groups: [] }) {
                id
                groups {
                    group {
                        id
                        name
                    }
                }
            }
        }
    """)
    variables = {"scene_id": scene_id, "group_id": group_id}
    try:
        await client.execute_async(mutation, variable_values=variables)

    except Exception as e:
        log.error(f"Error removing scene {scene_id} from group {group_id}: {e}")
        raise


def load_previous_tag_state():
    """
    Load the previous tag state from the JSON file.
    Returns a dictionary mapping scene_id to list of tag_ids.
    """
    if os.path.exists(TAG_STATE_FILE):
        try:
            with open(TAG_STATE_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            log.error(f"Error loading tag state from {TAG_STATE_FILE}: {e}")
            return {}
    log.info(f"No existing tag state file found at {TAG_STATE_FILE}. Starting fresh.")
    return {}


def save_current_tag_state(scene_tags_mapping):
    """
    Save the current tag state to the JSON file.
    """
    try:
        with open(TAG_STATE_FILE, "w") as f:
            json.dump(scene_tags_mapping, f, indent=4)

    except Exception as e:
        log.error(f"Error saving tag state to {TAG_STATE_FILE}: {e}")


async def fetch_server_info(payload):
    """
    Fetch the server's GraphQL URL and API key from the server connection in the payload.
    Returns a tuple of (graphql_url, api_key).
    """
    graphql_url = extract_server_connection(payload)
    if not graphql_url:
        graphql_url = DEFAULT_GRAPHQL_URL

    api_key = extract_api_key_from_payload(payload)
    return graphql_url, api_key


def extract_api_key_from_payload(payload):
    try:
        return payload.get("server_connection", {}).get("ApiKey", "")
    except Exception as e:
        log.error(f"Error extracting API key: {e}\n{traceback.format_exc()}")
        return ""


def extract_server_connection(payload):
    try:
        server_info = payload.get("server_connection", {})
        scheme = server_info.get("Scheme", "http")
        host = server_info.get("Host", "localhost")
        if host == "0.0.0.0":
            host = "localhost"
        port = server_info.get("Port", 9999)
        return f"{scheme}://{host}:{port}/graphql"
    except Exception as e:
        log.error(f"Error extracting server connection: {e}\n{traceback.format_exc()}")
        return None


async def fetch_configuration(client):
    """
    Fetch the plugin configuration to get the group-tag relationships.
    """
    query = gql("""
        query Configuration {
            configuration {
                plugins(include: "stashDynamicGroups")
            }
        }
    """)
    try:
        # Execute the query
        response = await client.execute_async(query)

        # Get the 'plugins' field from the response (already a dict)
        plugin_config = response.get("configuration", {}).get("plugins", {})

        # Extract the 'SetGroupTagRelationship' value
        group_tag_relationship = plugin_config.get("stashDynamicGroups", {}).get(
            "SetGroupTagRelationship", ""
        )

        return group_tag_relationship

    except Exception as e:
        log.error(f"Error fetching plugin configuration: {e}\n{traceback.format_exc()}")
        return ""


def parse_tag_group_mapping(relationship_string):
    """
    Parse the 'SetGroupTagRelationship' string into a dictionary mapping.
    """
    mapping = {}
    if relationship_string:
        pairs = relationship_string.split(",")  # Split by commas for multiple mappings
        for pair in pairs:
            try:
                tag, group = pair.split(":")
                mapping[tag.strip()] = group.strip()

            except ValueError as e:
                log.error(f"Error parsing group-tag relationship: {pair} - {e}")
    return mapping


async def fetch_scene(client, scene_id):
    query = gql("""
        query GetScene($scene_id: Int!) {
            findScenes(scene_filter: { id: { value: $scene_id, modifier: EQUALS } }) {
                scenes {
                    id
                    tags { id }
                    groups {
                        group {
                            id
                            name
                        }
                    }
                }
            }
        }
    """)
    variables = {"scene_id": scene_id}
    try:
        response = await client.execute_async(query, variable_values=variables)
        scenes = response.get("findScenes", {}).get("scenes", [])
        return scenes[0] if scenes else None
    except Exception as e:
        log.error(f"Error fetching scene {scene_id}: {e}\n{traceback.format_exc()}")
        return None


async def main():
    try:
        # Load previous tag state
        previous_tag_state = load_previous_tag_state()

        # Read the input from stdin
        input_data = sys.stdin.read()
        if not input_data.strip():
            log.error("No input received from Stash.")
            sys.exit(1)

        # Parse the JSON payload
        try:
            payload = json.loads(input_data)
        except json.JSONDecodeError as e:
            log.error(f"Failed to parse JSON payload: {e}")
            sys.exit(1)

        # Navigate to 'args.hookContext.input'
        hook_context = payload.get("args", {}).get("hookContext", {})
        input_fields = hook_context.get("input", {})

        # Extract scene IDs
        scene_ids = []
        if "ids" in input_fields:
            try:
                scene_ids = [int(id_) for id_ in input_fields.get("ids", [])]
            except ValueError as ve:
                log.error(f"Invalid scene ID in 'ids': {ve}")
        elif "id" in input_fields:
            try:
                scene_ids = [int(input_fields.get("id"))]
            except ValueError as ve:
                log.error(f"Invalid scene ID in 'id': {ve}")

        if not scene_ids:
            log.error("No scene IDs provided in the payload.")
            sys.exit(1)

        # Fetch the GraphQL server info (URL and API key)
        graphql_url, api_key = await fetch_server_info(payload)
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        transport = AIOHTTPTransport(
            url=graphql_url, headers=headers, timeout=REQUEST_TIMEOUT
        )
        client = Client(transport=transport, fetch_schema_from_transport=True)

        # Fetch plugin configuration
        relationship_string = await fetch_configuration(client)
        if not relationship_string:
            log.error("No group-tag relationships configured.")
            sys.exit(1)

        # Parse the group-tag relationship into a mapping
        tag_group_mapping = parse_tag_group_mapping(relationship_string)
        log.info(f"Parsed tag-group mapping: {tag_group_mapping}")

        # Process each scene
        for scene_id in scene_ids:
            # Fetch scene data using scene_id
            scene = await fetch_scene(client, scene_id)
            if not scene:
                log.error(f"Scene {scene_id} not found.")
                continue  # Skip to the next scene

            # Current tag IDs of the scene
            current_scene_tag_ids = set(
                map(str, [tag["id"] for tag in scene.get("tags", [])])
            )

            # Get previous tag_ids for the scene
            previous_tag_ids = set(previous_tag_state.get(str(scene_id)) or [])

            # Detect added and removed tags
            added_tags = current_scene_tag_ids - previous_tag_ids
            removed_tags = previous_tag_ids - current_scene_tag_ids

            # Handle Tag Additions
            for tag_id in added_tags:
                if tag_id in tag_group_mapping:
                    group_id = tag_group_mapping[tag_id]
                    in_group = await is_scene_in_group(client, scene_id, group_id)
                    if not in_group:
                        log.info(
                            f"Adding scene {scene_id} to group {group_id} due to tag {tag_id} addition."
                        )
                        await add_scene_to_group(client, scene_id, group_id)
                    else:
                        log.info(
                            f"Scene {scene_id} is already in group {group_id}. Skipping addition."
                        )

            # Handle Tag Removals
            for tag_id in removed_tags:
                if tag_id in tag_group_mapping:
                    group_id = tag_group_mapping[tag_id]
                    in_group = await is_scene_in_group(client, scene_id, group_id)
                    if in_group:
                        log.info(
                            f"Removing scene {scene_id} from group {group_id} due to tag {tag_id} removal."
                        )
                        await remove_scene_from_group(client, scene_id, group_id)
                    else:
                        log.info(
                            f"Scene {scene_id} is not in group {group_id}. Skipping removal."
                        )

            # Update the tag state after processing
            previous_tag_state[str(scene_id)] = list(current_scene_tag_ids)

        # Save the updated tag state
        save_current_tag_state(previous_tag_state)

    except Exception as e:
        log.error(f"Unhandled exception: {e}\n{traceback.format_exc()}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
