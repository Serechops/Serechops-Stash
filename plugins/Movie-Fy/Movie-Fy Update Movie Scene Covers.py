import requests
import stashapi.log as log  # Importing progress tracking module

# Define the GraphQL queries
all_movies_query = """
    query AllMovies {
        allMovies {
            id
            name
            front_image_path
            scenes {
                id
            }
        }
    }
"""

scene_update_mutation = """
    mutation SceneUpdate($movie_scene_id: ID!, $movie_front_image_path: String!) {
        sceneUpdate(input: { id: $movie_scene_id, cover_image: $movie_front_image_path }) {
            id
        }
    }
"""

# GraphQL endpoint
graphql_endpoint = "http://localhost:9999/graphql"

def update_scene_cover_images():
    # Send the GraphQL query to fetch all movies and their scenes
    response = requests.post(graphql_endpoint, json={"query": all_movies_query})
    data = response.json()
    
    if "data" in data and "allMovies" in data["data"]:
        all_movies = data["data"]["allMovies"]
        
        total_movies = len(all_movies)
        processed_movies = 0

        for movie in all_movies:
            movie_id = movie["id"]
            front_image_path = movie["front_image_path"]
            scenes = movie["scenes"]

            # Check if the scene cover image already matches the movie's front image
            if all(scene.get("cover_image") == front_image_path for scene in scenes):
                print(f"Skipping movie {movie_id}: all scene covers already match the movie front image")
                processed_movies += 1
                progress = processed_movies / total_movies
                log.progress(progress)
                continue

            # Update each scene with the movie's front image path
            for scene in scenes:
                scene_id = scene["id"]

                # Check if the scene cover image already matches the movie's front image
                if scene.get("cover_image") == front_image_path:
                    print(f"Skipping scene {scene_id} in movie {movie_id}: scene cover already matches the movie front image")
                    continue

                variables = {
                    "movie_scene_id": scene_id,
                    "movie_front_image_path": front_image_path
                }
                
                # Send the mutation to update the scene cover image
                mutation_response = requests.post(graphql_endpoint, json={"query": scene_update_mutation, "variables": variables})
                mutation_data = mutation_response.json()
                
                if "data" in mutation_data and "sceneUpdate" in mutation_data["data"]:
                    print(f"Updated scene {scene_id} cover image with movie front image for movie {movie_id}")
                else:
                    print(f"Failed to update scene {scene_id} cover image for movie {movie_id}")

            # Update progress for movies after processing all scenes for each movie
            processed_movies += 1
            progress = processed_movies / total_movies
            log.progress(progress)


if __name__ == "__main__":
    update_scene_cover_images()
