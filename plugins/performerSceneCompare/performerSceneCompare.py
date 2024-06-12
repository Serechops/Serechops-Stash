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
    headers = {'Content-Type': 'application/json'}
    if api_key:
        headers['Apikey'] = api_key
    response = requests.post(endpoint, json={'query': query, 'variables': variables}, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        logger.error(f"Query failed with status code {response.status_code}: {response.text}")
        return None

def local_graphql_request(query, variables=None):
    headers = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "ApiKey": config.LOCAL_API_KEY  # Use the local API key if available
    }
    response = requests.post(config.LOCAL_GQL_ENDPOINT, json={'query': query, 'variables': variables}, headers=headers)
    try:
        data = response.json()
        return data.get('data')
    except json.JSONDecodeError:
        logger.error(f"Failed to decode JSON from response: {response.text}")
        return None

def missing_graphql_request(query, variables=None):
    headers = {
        "Accept-Encoding": "gzip, deflate, br",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "ApiKey": config.MISSING_API_KEY  # Use the local API key if available
    }
    response = requests.post(config.LOCAL_GQL_ENDPOINT, json={'query': query, 'variables': variables}, headers=headers)
    try:
        data = response.json()
        return data.get('data')
    except json.JSONDecodeError:
        logger.error(f"Failed to decode JSON from response: {response.text}")
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
    if result and result['allPerformers']:
        # Sort performers by 'updated_at' field in descending order
        sorted_performers = sorted(result['allPerformers'], key=lambda x: x['updated_at'], reverse=True)
        if sorted_performers:
            return sorted_performers[0]['id']
    logger.error("No performers found.")
    return None

def get_performer_details(performer_id):
    query = """
        query FindPerformer($id: ID!) {
            findPerformer(id: $id) {
                id
                name
                stash_ids {
                    stash_id
                }
                scenes {
                    title
                    stash_ids {
                        stash_id
                    }
                }
            }
        }
    """
    result = local_graphql_request(query, {"id": performer_id})
    if result:
        return result['findPerformer']
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
        result = gql_query(config.STASHDB_ENDPOINT, query, {"stash_ids": performer_stash_ids, "page": page}, config.STASHDB_API_KEY)
        if result:
            scenes_data = result['data']['queryScenes']
            scenes.extend(scenes_data['scenes'])
            total_scenes = total_scenes or scenes_data['count']
            if len(scenes) >= total_scenes or len(scenes_data['scenes']) < 25:
                break
            page += 1
        else:
            break
    return scenes

def compare_scenes(local_scenes, stashdb_scenes):
    local_scene_ids = {scene['stash_ids'][0]['stash_id'] for scene in local_scenes if scene['stash_ids']}

    missing_scenes = [scene for scene in stashdb_scenes if scene['id'] not in local_scene_ids]
    logger.info(f"Found {len(missing_scenes)} missing scenes.")
    return missing_scenes

def create_scene(code, title, studio_url, date, cover_image):
    try:
        # Ensure the date is in the correct format
        formatted_date = datetime.strptime(date, "%Y-%m-%d").date().isoformat() if date else None
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
            "cover_image": cover_image
        }
    }
    result = missing_graphql_request(mutation, variables)
    if result and 'sceneCreate' in result:
        scene_id = result['sceneCreate']['id']
        logger.info(f"Scene created with ID: {scene_id}")
        return scene_id
    logger.error(f"Failed to create scene '{title}'")
    return None

def create_studio(performer_name):
    mutation = """
        mutation StudioCreate($input: StudioCreateInput!) {
            studioCreate(input: $input) {
                id
                name
            }
        }
    """
    variables = {"input": {"name": f"{performer_name} - Missing Scenes"}}
    result = missing_graphql_request(mutation, variables)
    if result and 'studioCreate' in result:
        studio_id = result['studioCreate']['id']
        logger.info(f"Studio created: {performer_name} - Missing Scenes with ID: {studio_id}")
        return studio_id
    logger.error(f"Failed to create studio for performer '{performer_name}'")
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
    variables = {
        "input": {
            "id": scene_id,
            "studio_id": studio_id
        }
    }
    result = missing_graphql_request(mutation, variables)
    if result and 'sceneUpdate' in result:
        logger.info(f"Scene {scene_id} updated to include studio {studio_id}")
    else:
        logger.error(f"Failed to update scene {scene_id} with studio {studio_id}")

def compare_performer_scenes():
    performer_id = get_most_recently_updated_performer()
    if performer_id:
        performer_details = get_performer_details(performer_id)
        if performer_details:
            logger.info(f"Processing performer: {performer_details['name']}")

            # Create a studio for the missing scenes of this performer
            studio_id = create_studio(performer_details['name'])
            logger.info(f"Studio created: {performer_details['name']} - Missing Scenes with ID: {studio_id}")

            local_scenes = performer_details['scenes']
            stash_ids = [sid['stash_id'] for sid in performer_details['stash_ids']]
            stashdb_scenes = query_stashdb_scenes(stash_ids)
            missing_scenes = compare_scenes(local_scenes, stashdb_scenes)

            if missing_scenes:
                total_scenes = len(missing_scenes)
                processed_scenes = 0

                for scene in missing_scenes:
                    # Create scene and link it to the new studio
                    created_scene_id = create_scene(
                        code=scene['code'],
                        title=scene['title'],
                        studio_url=scene['urls'][0]['url'] if scene['urls'] else None,
                        date=scene['release_date'],
                        cover_image=scene['images'][0]['url'] if scene['images'] else None
                    )
                    if created_scene_id:
                        update_scene_with_studio(created_scene_id, studio_id)
                        logger.info(f"Scene {created_scene_id} created and associated with studio {studio_id}")

                    # Update progress
                    processed_scenes += 1
                    progress = processed_scenes / total_scenes
                    logger.progress(progress)

                logger.info(f"{total_scenes} missing scenes processed and associated with studio for performer {performer_details['name']}.")
            else:
                logger.info(f"All scenes for performer {performer_details['name']} are up-to-date with StashDB.")
        else:
            logger.error("Failed to retrieve details for performer.")
    else:
        logger.error("No recently updated performer found.")

if __name__ == "__main__":
    compare_performer_scenes()
