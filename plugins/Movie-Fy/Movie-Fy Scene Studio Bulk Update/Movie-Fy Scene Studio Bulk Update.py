import requests
import stashapi.log as log

def get_all_movies():
    query = """
    query AllMovies {
        allMovies {
            id
            name
            studio {
                id
                name
            }
            scenes {
                id
                title
                studio {
                    id
                    name
                }
            }
        }
    }
    """
    response = requests.post("http://localhost:9999/graphql", json={"query": query})
    data = response.json()
    return data.get("data", {}).get("allMovies", [])

def update_scene_studio(scene_id, studio_id):
    mutation = """
    mutation SceneUpdate($scene_id: ID!, $studio_id: ID!) {
        sceneUpdate(input: { id: $scene_id, studio_id: $studio_id }) {
            id
        }
    }
    """
    variables = {
        "scene_id": scene_id,
        "studio_id": studio_id
    }
    response = requests.post("http://localhost:9999/graphql", json={"query": mutation, "variables": variables})
    return response.json()

def main():
    log.info("Starting update process...")
    movies = get_all_movies()
    total_scenes = sum(len(movie.get("scenes", [])) for movie in movies)
    processed_scenes = 0

    for movie in movies:
        movie_id = movie.get("id")
        movie_name = movie.get("name")
        movie_studio = movie.get("studio")
        if movie_studio is None:
            log.warning(f"No studio set for movie: {movie_name}. Skipping...")
            continue
        
        movie_studio_id = movie_studio.get("id")
        scenes = movie.get("scenes", [])

        for scene in scenes:
            scene_id = scene.get("id")
            scene_title = scene.get("title")
            scene_studio = scene.get("studio")
            if scene_studio is None:
                log.warning(f"No studio set for scene {scene_id}. Skipping...")
                continue
            
            scene_studio_id = scene_studio.get("id")
            scene_studio_name = scene_studio.get("name")
            if scene_studio_id != movie_studio_id:
                log.info(f"Updating scene {scene_id} with studio ID {movie_studio_id} for studio: {scene_studio_name}")
                update_scene_studio(scene_id, movie_studio_id)
                log.info(f"Scene updated successfully - ID: {scene_id}, Title: {scene_title}, Studio: {movie_studio}")
            
            processed_scenes += 1
            script_progress = processed_scenes / total_scenes
            log.progress(script_progress)

    log.info("Update process completed.")

if __name__ == "__main__":
    main()
