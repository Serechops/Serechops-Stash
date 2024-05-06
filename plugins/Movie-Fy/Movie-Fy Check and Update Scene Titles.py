import re
import requests
import stashapi.log as log

# Function to find studio ID, specifically looking for the studio named "Movie"
def find_studio_id():
    find_studios_url = "http://localhost:9999/graphql"
    find_studios_payload = {
        "query": """
            query FindStudios {
                findStudios(studio_filter: { name: { value: "Movie", modifier: EQUALS } }) {
                    studios {
                        id
                    }
                }
            }
        """
    }
    try:
        response = requests.post(find_studios_url, json=find_studios_payload)
        result = response.json()
        if "data" in result and "findStudios" in result["data"] and result["data"]["findStudios"]["studios"]:
            log.info("Studio ID found successfully.")
            return result["data"]["findStudios"]["studios"][0]["id"]
        else:
            log.error(f"Error finding studios: {result.get('errors', 'Unknown Error')}")
            return None
    except Exception as e:
        log.error(f"Exception in finding studio ID: {str(e)}")
        return None

def find_scenes(studio_id):
    find_scenes_url = "http://localhost:9999/graphql"
    find_scenes_payload = {
        "query": f"""
            query FindScenes {{
                findScenes(
                    scene_filter: {{ studios: {{ value: "{studio_id}", modifier: EQUALS }} }},
                    filter: {{ per_page: -1 }}
                ) {{
                    scenes {{
                        id
                        title
                    }}
                }}
            }}
        """
    }
    try:
        response = requests.post(find_scenes_url, json=find_scenes_payload)
        result = response.json()
        if "data" in result and "findScenes" in result["data"]:
            log.info("Scenes found successfully.")
            return result["data"]["findScenes"]["scenes"]
        else:
            log.error(f"Error finding scenes: {result.get('errors')}")
            return None
    except Exception as e:
        log.error(f"Exception in finding scenes: {str(e)}")
        return None

def find_scene_details(scene_id):
    find_scene_query = f"""
        query FindScene {{
            findScene(id: {scene_id}) {{
                title
                files {{
                    basename
                }}
            }}
        }}
    """
    try:
        response = requests.post("http://localhost:9999/graphql", json={"query": find_scene_query})
        result = response.json()
        if "data" in result and "findScene" in result["data"]:
            log.info("Scene details retrieved successfully.")
            return result["data"]["findScene"]
        else:
            log.error(f"Error finding scene details: {result.get('errors')}")
            return None
    except Exception as e:
        log.error(f"Exception in finding scene details: {str(e)}")
        return None

def update_title_with_basename(scene_id, file_basename):
    title = re.sub(r'\.[^.]*$', '', file_basename)
    update_scene_mutation = f"""
        mutation SceneUpdate {{
            sceneUpdate(input: {{ id: {scene_id}, title: "{title}" }}) {{
                title
            }}
        }}
    """
    try:
        log.debug(f"GraphQL Mutation to Update Scene Title: {update_scene_mutation}")
        response = requests.post("http://localhost:9999/graphql", json={"query": update_scene_mutation})
        result = response.json()
        if result.get("data"):
            log.info(f"Updated Scene ID: {scene_id} with new title: {title}")
        else:
            log.error(f"Failed to update title for Scene ID: {scene_id}")
    except Exception as e:
        log.error(f"Exception during mutation for Scene ID: {scene_id}: {str(e)}")

if __name__ == "__main__":
    log.info("Starting process to find scenes for Studio: Movie")
    studio_id = find_studio_id()

    if studio_id:
        scenes = find_scenes(studio_id)

        if scenes:
            log.info("Processing scenes for updates.")
            for scene in scenes:
                scene_details = find_scene_details(scene['id'])

                if scene_details:
                    title = scene_details["title"]
                    file_basename = scene_details["files"][0]["basename"] if scene_details["files"] else None
                    if not title and file_basename:
                        update_title_with_basename(scene['id'], file_basename)
                    else:
                        log.info(f"No update needed for Scene ID: {scene['id']}.")
                else:
                    log.error("Failed to retrieve details for scene.")
        else:
            log.error("No scenes found for studio.")
    else:
        log.error("Failed to retrieve studio ID for 'Movie'.")
