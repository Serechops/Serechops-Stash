import requests
import json
import os
import sys
import stashapi.log as logger
from datetime import datetime

# Ensure the script can locate config.py
script_dir = os.path.dirname(os.path.realpath(__file__))
sys.path.append(script_dir)

import config  # Import the configuration


def gql_query(endpoint, query, variables=None, api_key=None):
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Apikey"] = api_key
    response = requests.post(
        endpoint, json={"query": query, "variables": variables}, headers=headers
    )
    if response.status_code == 200:
        return response.json()
    else:
        logger.error(
            f"Query failed with status code {response.status_code}: {response.text}"
        )
        return None


def local_graphql_request(query, variables=None):
    return graphql_request(
        query, config.LOCAL_GQL_ENDPOINT, config.LOCAL_API_KEY, variables
    )


def missing_graphql_request(query, variables=None):
    return graphql_request(
        query, config.MISSING_GQL_ENDPOINT, config.MISSING_API_KEY, variables
    )


def graphql_request(query, endpoint, api_key, variables=None):
    headers = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "ApiKey": api_key,  # Use the local API key if available
    }
    try:
        response = requests.post(
            endpoint,
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=120,  # Set a timeout for the request
        )
        logger.debug(
            f"Request to {endpoint} returned status code {response.status_code}"
        )
        response.raise_for_status()  # Raises HTTPError for bad responses (4XX, 5XX)
        try:
            data = response.json()
            return data.get("data")
        except json.JSONDecodeError:
            logger.error(f"Failed to decode JSON from response: {response.text}")
            return None
    except requests.HTTPError as http_err:
        logger.error(f"HTTP error occurred: {http_err} - Response: {response.text}")
    except requests.Timeout:
        logger.error("The request timed out")
    except requests.RequestException as err:
        logger.error(f"Error during requests to {endpoint}: {err}")
    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}")
    return None


def get_most_recently_updated_performer():
    query = """
        query AllPerformers {
            allPerformers {
                id
                updated_at
            }
        }
    """
    result = local_graphql_request(query)
    if result and result["allPerformers"]:
        # Sort performers by 'updated_at' field in descending order
        sorted_performers = sorted(
            result["allPerformers"], key=lambda x: x["updated_at"], reverse=True
        )
        if sorted_performers:
            return sorted_performers[0]["id"]
    logger.error("No performers found.")
    return None


def get_studio_by_name(studio_name):
    query = """
        query FindStudios($filter: FindFilterType, $studio_filter: StudioFilterType) {
            findStudios(filter: $filter, studio_filter: $studio_filter) {
                count
                studios {
                    id
                    name
                    parent_studio {
                        id
                        name
                    }
                }
            }
        }
    """
    variables = {"filter": {"q": studio_name}}
    result = missing_graphql_request(query, variables)
    if result:
        return result["findStudios"]
    logger.error(f"No studios found with name {studio_name}.")
    return None


def get_studio_by_name_by_stash_id(stash_id):
    query = """
        query FindStudios($filter: FindFilterType, $studio_filter: StudioFilterType) {
            findStudios(filter: $filter, studio_filter: $studio_filter) {
                count
                studios {
                    id
                    name
                    parent_studio {
                        id
                        name
                    }
                }
            }
        }
    """
    variables = {
        "filter": {},
        "studio_filter": {
            "stash_id_endpoint": {
                "endpoint": config.STASHDB_ENDPOINT,
                "modifier": "EQUALS",
                "stash_id": stash_id,
            }
        },
    }
    result = missing_graphql_request(query, variables)
    if result:
        return result["findStudios"]
    logger.error(f"No studios found with Stash ID {stash_id}.")
    return None


def get_local_performer_details(performer_id):
    query = """
        query FindPerformer($id: ID!) {
            findPerformer(id: $id) {
                id
                name
                stash_ids {
                    stash_id
                    endpoint
                }
                scenes {
                    title
                    stash_ids {
                        stash_id
                        endpoint
                    }
                }
            }
        }
    """
    result = local_graphql_request(query, {"id": performer_id})
    if result:
        return result["findPerformer"]
    logger.error(f"No details found for performer ID {performer_id}.")
    return None


def get_missing_performer_details(performer_id):
    query = """
        query FindPerformer($id: ID!) {
            findPerformer(id: $id) {
                id
                name
                stash_ids {
                    stash_id
                    endpoint
                }
                scenes {
                    id
                    title
                    stash_ids {
                        stash_id
                        endpoint
                    }
                }
            }
        }
    """
    result = missing_graphql_request(query, {"id": performer_id})
    if result:
        return result["findPerformer"]
    logger.error(f"No details found for performer ID {performer_id}.")
    return None


def query_stashdb_scenes(performer_stash_ids):
    query = """
        query QueryScenes($stash_ids: [ID!]!, $page: Int!) {
            queryScenes(
                input: {
                    performers: {
                        value: $stash_ids,
                        modifier: INCLUDES
                    },
                    per_page: 25,
                    page: $page
                }
            ) {
                scenes {
                    id
                    title
                    release_date
                    urls {
                        url
                        site {
                            name
                            url
                        }
                    }
                    studio {
                        id
                        name
                    }
                    images {
                        id
                        url
                    }
                    performers {
                        performer {
                            id
                            name
                        }
                    }
                    duration
                    code
                }
                count
            }
        }
    """
    scenes = []
    page = 1
    total_scenes = None
    while True:
        result = gql_query(
            config.STASHDB_ENDPOINT,
            query,
            {"stash_ids": performer_stash_ids, "page": page},
            config.STASHDB_API_KEY,
        )
        if result:
            scenes_data = result["data"]["queryScenes"]
            scenes.extend(scenes_data["scenes"])
            total_scenes = total_scenes or scenes_data["count"]
            if len(scenes) >= total_scenes or len(scenes_data["scenes"]) < 25:
                break
            page += 1
        else:
            break
    return scenes


def compare_scenes(local_scenes, existing_missing_scenes, stashdb_scenes):
    local_scene_ids = {
        stash_id["stash_id"]
        for scene in local_scenes
        for stash_id in scene["stash_ids"]
        if stash_id.get("endpoint") == config.STASHDB_ENDPOINT
    }
    logger.debug(f"Local scene IDs: {local_scene_ids}")
    existing_missing_scene_ids = {
        stash_id["stash_id"]
        for scene in existing_missing_scenes
        for stash_id in scene["stash_ids"]
        if stash_id.get("endpoint") == config.STASHDB_ENDPOINT
    }
    logger.debug(f"Existing missing scene IDs: {existing_missing_scene_ids}")

    new_missing_scenes = [
        scene
        for scene in stashdb_scenes
        if scene["id"] not in local_scene_ids
        and scene["id"] not in existing_missing_scene_ids
    ]
    logger.info(f"Found {len(new_missing_scenes)} new missing scenes.")
    return new_missing_scenes


def create_scene(scene, performer_id):
    code = scene["code"]
    title = scene["title"]
    studio_url = scene["urls"][0]["url"] if scene["urls"] else None
    date = scene["release_date"]
    cover_image = scene["images"][0]["url"] if scene["images"] else None
    stash_id = scene["id"]

    try:
        # Ensure the date is in the correct format
        formatted_date = (
            datetime.strptime(date, "%Y-%m-%d").date().isoformat() if date else None
        )
    except ValueError:
        logger.error(f"Invalid date format for scene '{title}': {date}")
        return None

    mutation = """
        mutation SceneCreate($input: SceneCreateInput!) {
            sceneCreate(input: $input) {
                id
                title
            }
        }
    """
    variables = {
        "input": {
            "code": code,
            "title": title,
            "url": studio_url,
            "date": formatted_date,
            "cover_image": cover_image,
            "performer_ids": [performer_id],
            "stash_ids": [
                {"endpoint": "https://stashdb.org/graphql", "stash_id": stash_id}
            ],
        }
    }
    result = missing_graphql_request(mutation, variables)
    logger.debug(f"GraphQL request result: {result}")
    if result and "sceneCreate" in result:
        scene_id = result["sceneCreate"]["id"]
        logger.info(f"Scene created with ID: {scene_id}")
        return scene_id
    logger.error(f"Failed to create scene '{title}'")
    return None


def destroy_missing_scene(scene_id):
    mutation = """
        mutation SceneDestroy($input: SceneDestroyInput!) {
            sceneDestroy(input: $input)
        }
    """
    variables = {
        "input": {
            "id": scene_id,
            "delete_file": False,
            "delete_generated": True,
        }
    }
    result = missing_graphql_request(mutation, variables)
    logger.debug(f"GraphQL request result: {result}")
    if result is not None and result.get("sceneDestroy") is True:
        logger.info(f"Scene destroyed with ID: {scene_id}")
        return None
    logger.error(f"Failed to destroy scene '{scene_id}'")
    return None


def get_or_create_studio_by_stash_id(studio):
    stash_id = studio["id"]
    studio_name = studio["name"]

    studio = get_studio_by_name_by_stash_id(stash_id)
    if studio and studio["count"] > 0:
        studio_id = studio["studios"][0]["id"]
        logger.info(
            f"Studio found: StashDB ID {stash_id} with Stashapp ID: {studio_id}"
        )
        return studio_id

    mutation = """
        mutation StudioCreate($input: StudioCreateInput!) {
            studioCreate(input: $input) {
                id
                name
                stash_ids {
                    stash_id
                    endpoint
                }
            }
        }
    """
    variables = {
        "input": {
            "name": studio_name,
            "stash_ids": [{"stash_id": stash_id, "endpoint": config.STASHDB_ENDPOINT}],
        }
    }
    logger.debug(f"Creating scene: {studio_name}")
    result = missing_graphql_request(mutation, variables)
    logger.debug(f"GraphQL request result: {result}")
    if result and "studioCreate" in result and result["studioCreate"]:
        studio_id = result["studioCreate"]["id"]
        logger.info(f"Studio created: {studio_name}")
        return studio_id
    logger.error(f"Failed to create studio for performer '{studio_name}'")
    return None


def get_or_create_missing_performer(performer_name, performer_stash_id):
    performers = find_performer_by_stash_id(performer_stash_id)
    if performers and performers["count"] > 0:
        performer_id = performers["performers"][0]["id"]
        logger.info(
            f"Performer found with stash ID {performer_stash_id} with ID: {performer_id}"
        )
        return performer_id

    mutation = """
        mutation PerformerCreate($input: PerformerCreateInput!) {
            performerCreate(input: $input) {
                id
                name
                stash_ids {
                    stash_id
                    endpoint
                }
            }
        }
    """
    variables = {
        "input": {
            "name": performer_name,
            "stash_ids": [
                {"stash_id": performer_stash_id, "endpoint": config.STASHDB_ENDPOINT}
            ],
        }
    }
    result = missing_graphql_request(mutation, variables)

    if result and "performerCreate" in result:
        performer_id = result["performerCreate"]["id"]
        logger.info(f"Performer created: {performer_name}")
        return performer_id
    logger.error(f"Failed to create performer '{performer_name}'")
    return None


def find_local_favorite_performers():
    query = """
        query FindPerformers($performer_filter: PerformerFilterType) {
            findPerformers(performer_filter: $performer_filter) {
                count
                performers {
                    id
                    name
                    gender
                    stash_ids {
                        stash_id
                        endpoint
                    }
                }
            }
        }
    """
    variables = {"performer_filter": {"filter_favorites": True}}
    logger.info(f"Searching for local favorite performers")
    logger.debug(f"Query: {query}")
    logger.debug(f"Query variables: {variables}")
    result = local_graphql_request(query, variables)
    logger.debug(f"GraphQL request result: {result}")
    if result:
        return result["findPerformers"]
    logger.error(f"No favorite performer data found.")
    return None


def find_performer_by_stash_id(performer_stash_id):
    query = """
        query FindPerformers($performer_filter: PerformerFilterType) {
            findPerformers(performer_filter: $performer_filter) {
                count
                performers {
                    id
                    name
                    gender
                    stash_ids {
                        stash_id
                        endpoint
                    }
                }
            }
        }
    """
    variables = {
        "performer_filter": {
            "stash_id_endpoint": {
                "endpoint": config.STASHDB_ENDPOINT,
                "stash_id": performer_stash_id,
                "modifier": "EQUALS",
            }
        }
    }
    logger.info(f"Searching for performer with stash ID {performer_stash_id}")
    logger.debug(f"Query: {query}")
    logger.debug(f"Query variables: {variables}")
    result = missing_graphql_request(query, variables)
    logger.debug(f"GraphQL request result: {result}")
    if result:
        return result["findPerformers"]
    logger.error(f"No performers found with stash ID {performer_stash_id}.")
    return None


def update_scene_with_studio(scene_id, studio_id):
    mutation = """
        mutation SceneUpdate($input: SceneUpdateInput!) {
            sceneUpdate(input: $input) {
                id
                title
            }
        }
    """
    variables = {"input": {"id": scene_id, "studio_id": studio_id}}
    result = missing_graphql_request(mutation, variables)
    if result and "sceneUpdate" in result:
        logger.info(f"Scene {scene_id} updated to include studio {studio_id}")
    else:
        logger.error(f"Failed to update scene {scene_id} with studio {studio_id}")


def process_performer(performer_id: int):
    performer_details = get_local_performer_details(performer_id)
    if not performer_details:
        logger.error("Failed to retrieve details for performer.")
        return

    logger.info(f"Processing performer: {performer_details['name']}")

    performer_name = performer_details["name"]
    performer_stash_id = next(
        (
            sid["stash_id"]
            for sid in performer_details["stash_ids"]
            if sid.get("endpoint") == config.STASHDB_ENDPOINT
        ),
        None,
    )
    missing_performer_id = get_or_create_missing_performer(
        performer_name, performer_stash_id
    )
    missing_performer_details = get_missing_performer_details(missing_performer_id)

    local_scenes = performer_details["scenes"]
    existing_missing_scenes = missing_performer_details["scenes"]
    stash_ids = [sid["stash_id"] for sid in performer_details["stash_ids"]]
    stashdb_scenes = query_stashdb_scenes(stash_ids)

    for local_scene in local_scenes:
        local_scene_stash_id = next(
            (
                sid["stash_id"]
                for sid in local_scene["stash_ids"]
                if sid.get("endpoint") == config.STASHDB_ENDPOINT
            ),
            None,
        )
        for existing_missing_scene in existing_missing_scenes:
            existing_missing_scene_stash_id = next(
                (
                    sid["stash_id"]
                    for sid in existing_missing_scene["stash_ids"]
                    if sid.get("endpoint") == config.STASHDB_ENDPOINT
                ),
                None,
            )
            if local_scene_stash_id == existing_missing_scene_stash_id:
                destroy_missing_scene(existing_missing_scene["id"])
                logger.info(f"Scene {existing_missing_scene['id']} destroyed.")

    missing_scenes = compare_scenes(
        local_scenes, existing_missing_scenes, stashdb_scenes
    )
    if not missing_scenes:
        logger.info(
            f"All scenes for performer {performer_details['name']} are up-to-date with StashDB."
        )

    total_scenes = len(missing_scenes)
    processed_scenes = 0
    for scene in missing_scenes:
        scene_studio_id = get_or_create_studio_by_stash_id(scene["studio"])

        # Create scene and link it to the new studio
        created_scene_id = create_scene(scene, missing_performer_id)
        if created_scene_id:
            update_scene_with_studio(created_scene_id, scene_studio_id)
            logger.info(
                f"Scene {created_scene_id} created and associated with studio {scene_studio_id}"
            )

            # Update progress
            processed_scenes += 1
            progress = processed_scenes / total_scenes
            logger.progress(progress)

    logger.info(
        f"{total_scenes} missing scenes processed and associated with studio for performer {performer_details['name']}."
    )


def compare_performer_scenes():
    json_input = json.loads(sys.stdin.read())
    logger.debug(f"Input: {json_input}")

    favorite_performers = find_local_favorite_performers()
    logger.debug(f"Favorite performers: {favorite_performers}")

    for performer in favorite_performers["performers"]:
        performer_id = performer["id"]
        process_performer(performer_id)


if __name__ == "__main__":
    compare_performer_scenes()
