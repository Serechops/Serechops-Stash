import re
import requests

def find_studio_id(studio_name):
    find_studios_url = "http://localhost:9999/graphql"
    find_studios_payload = {
        "query": f"""
            query FindStudios {{
                findStudios(filter: {{ q: "{studio_name}" }}) {{
                    studios {{
                        id
                    }}
                }}
            }}
        """
    }

    response = requests.post(find_studios_url, json=find_studios_payload)
    result = response.json()

    if "data" in result and "findStudios" in result["data"]:
        studios = result["data"]["findStudios"]["studios"]
        if studios:
            return studios[0]["id"]
        else:
            print(f"Studio with name '{studio_name}' not found.")
            return None
    else:
        print("Error finding studios:", result.get("errors"))
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

    response = requests.post(find_scenes_url, json=find_scenes_payload)
    result = response.json()

    if "data" in result and "findScenes" in result["data"]:
        return result["data"]["findScenes"]["scenes"]
    else:
        print("Error finding scenes:", result.get("errors"))
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

    response = requests.post("http://localhost:9999/graphql", json={"query": find_scene_query})
    result = response.json()

    if "data" in result and "findScene" in result["data"]:
        return result["data"]["findScene"]
    else:
        print("Error finding scene details:", result.get("errors"))
        return None

def update_title_with_basename(scene_id, file_basename):
    # Use regex to remove file extension
    title = re.sub(r'\.[^.]*$', '', file_basename)

    # GraphQL mutation to update scene title
    update_scene_mutation = f"""
        mutation SceneUpdate {{
            sceneUpdate(input: {{ id: {scene_id}, title: "{title}" }}) {{
                title
            }}
        }}
    """

    print("\nGraphQL Mutation to Update Scene Title:")
    print(update_scene_mutation)

    # Uncomment the following lines to execute the mutation
    response = requests.post("http://localhost:9999/graphql", json={"query": update_scene_mutation})
    result = response.json()
    print("Mutation Result:", result)

if __name__ == "__main__":
    studio_name = "Movie"

    print(f"Finding scenes for Studio: {studio_name}")

    studio_id = find_studio_id(studio_name)

    if studio_id:
        print(f"Found Studio ID for '{studio_name}': {studio_id}")

        scenes = find_scenes(studio_id)

        if scenes:
            print(f"\nScenes for Studio '{studio_name}':")
            for scene in scenes:
                print(f"Scene ID: {scene['id']}, Title: {scene['title']}")

            print("\nChecking and updating titles:")
            for scene in scenes:
                scene_details = find_scene_details(scene['id'])

                if scene_details:
                    title = scene_details["title"]
                    file_basename = scene_details["files"][0]["basename"] if scene_details["files"] else None

                    print("\nScene Details:")
                    print(f"Scene ID: {scene['id']}")
                    print(f"Title: {title}")
                    print(f"File Basename: {file_basename}")

                    if not title and file_basename:
                        update_title_with_basename(scene['id'], file_basename)
                    else:
                        print("No action needed. Scene already has a title or is missing a file basename.")
                else:
                    print(f"Could not retrieve scene details for Scene ID: {scene['id']}")
        else:
            print(f"No scenes found for Studio '{studio_name}'.")
    else:
        print(f"Could not proceed without Studio ID for '{studio_name}'.")
