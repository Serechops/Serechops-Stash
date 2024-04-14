import json
import requests
from thefuzz import process
import re
from collections import defaultdict
import os

# Global variable to store scene IDs
scene_ids = []
current_scene_index = 0
previous_search_results = None
previous_movie_id = None

# Function to find studio ID
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
    response = requests.post(find_studios_url, json=find_studios_payload)
    result = response.json()
    if "data" in result and "findStudios" in result["data"] and result["data"]["findStudios"]["studios"]:
        return result["data"]["findStudios"]["studios"][0]["id"]
    else:
        print("Error finding studios:", result.get("errors", "Unknown Error"))
        return None

# Function to find scenes
def find_scenes(studio_id):
    find_scenes_url = "http://localhost:9999/graphql"
    query_string = """
        query FindScenes {
            findScenes(
                filter: { per_page: -1 },
                scene_filter: { studios: { value: "%s", modifier: EQUALS } }
            ) {
                scenes {
                    id
                    title
                    files {
                        id
                        path
                    }
                    movies {
                        movie {
                            id
                            name
                        }
                    }
                }
            }
        }
    """ % studio_id
    find_scenes_payload = {"query": query_string}

    try:
        response = requests.post(find_scenes_url, json=find_scenes_payload)
        response.raise_for_status()
        result = response.json()
        if "data" in result and "findScenes" in result["data"]:
            return result["data"]["findScenes"]["scenes"]
        else:
            print("Error finding scenes:", result.get("errors", "Unknown Error"))
            return None
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error: {e}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error sending request to server: {e}")
        return None
    except ValueError as e:
        print(f"Error parsing JSON response: {e}")
        return None


def process_scenes(studio_id, scenes, movie_data):
    global scene_groups  # Declare scene_groups as global
    
    scene_groups = defaultdict(list)

    for current_scene_index, scene in enumerate(scenes):
        print(f"Processing scene: {scene['title']}")
        
        # Check if the scene is already attached to a movie
        if scene['movies']:
            print("Scene is already attached to a movie. Skipping.")
            continue
        
        # Extract the subdirectory from the file path
        file_path = scene.get('files', [{}])[0].get('path', '')
        subdirectory = os.path.dirname(file_path)
        
        # Group scenes by subdirectory
        scene_groups[subdirectory].append(scene)
    
    # Process scene groups after all scenes are grouped
    process_scene_groups(scene_groups, movie_data)

# Function to handle movie matches found through fuzzy search
def handle_movie_matches(movie_matches, group_scenes, movie_data):
    global current_scene_group_scenes
    global current_scene_group_key

    print("Fuzzy search results:")
    for i, match in enumerate(movie_matches, start=1):
        print(f"{i}. {match['Name']} ({match['Source']})")
    choice = input("Enter the number of the correct match, 'c' for custom search, 's' to skip, or 'r' to restart: ")
    if choice.lower() == 'c':
        # Preserve the current scene group key for custom search loop
        current_scene_group_key = scene_group_key  # Assuming `scene_group_key` is defined somewhere
        current_scene_group_scenes = group_scenes.copy()
        custom_search_term = input("Enter a custom search term: ")
        custom_movie_matches = find_movie_info(custom_search_term, movie_data)
        handle_custom_search(custom_movie_matches, movie_data)  # Remove unnecessary arguments
    elif choice.lower() == 's':
        print("Skipping group.")
    elif choice.lower() == 'r':
        main()
    else:
        try:
            choice_index = int(choice) - 1
            if 0 <= choice_index < len(movie_matches):
                selected_movie = movie_matches[choice_index]
                update_scenes_with_selected_movie(selected_movie, group_scenes)
                # After selecting the movie, update scenes with the selected movie
                movie_id = find_or_create_movie(selected_movie['Name'])
                if movie_id:
                    for scene in group_scenes:
                        if not update_scenes_with_movie(scene['id'], movie_id):
                            print(f"Failed to add scene '{scene['title']}' to movie {movie_id}.")
                    print(f"All scenes successfully added to movie {movie_id}.")
                else:
                    print("Failed to find or create the selected movie.")
            else:
                print("Invalid choice.")
        except ValueError:
            print("Invalid choice.")



def update_scenes_with_selected_movie(selected_movie, group_scenes):
    movie_name = selected_movie['Name']
    movie_url = selected_movie['Source']  # Assuming 'Source' contains the movie URL
    movie_id = find_or_create_movie(movie_name, movie_url)  # Pass both movie name and URL
    if movie_id:
        for scene in group_scenes:
            if not update_scenes_with_movie(scene['id'], movie_id):
                print(f"Failed to add scene '{scene['title']}' to movie {movie_id}.")
        print(f"All scenes successfully added to movie {movie_id}.")
    else:
        print("Failed to find or create the selected movie.")


def find_or_create_movie(movie_name, movie_url):
    existing_movie_id = find_movie_id(movie_name)
    if existing_movie_id:
        return existing_movie_id
    else:
        created_movie_id, success = create_movie(movie_name, movie_url)
        if success:
            return created_movie_id
        else:
            return None


# Function to find movie information with fuzzy matching and lexical sorting
def find_movie_info(movie_name, movie_data):
    matches = []
    unique_urls = set()  # Set to store unique URLs
    for entry in movie_data:
        match_ratio = process.extractOne(movie_name.lower(), [entry.get('Name', '').lower()])
        if match_ratio[1] >= 90:  # Adjust threshold as needed
            # Check if URL is unique before adding to matches
            if entry['Source'] not in unique_urls:
                matches.append(entry)
                unique_urls.add(entry['Source'])
    # Sort matches lexicographically by movie name
    matches.sort(key=lambda x: (re.split(r'(\d+)', x['Name'].lower()), x['Name']))
    return matches

# Function to create a new movie with title and URL
def create_movie(movie_name, movie_url):
    movie_create_url = "http://localhost:9999/graphql"

    # Constructing the mutation string using title and URL
    mutation_string = f"""
        mutation MovieCreate {{
            movieCreate(
                input: {{
                    name: "{movie_name}"
                    url: "{movie_url}"
                }}
            ) {{
                id
            }}
        }}
    """

    movie_create_payload = {"query": mutation_string}

    try:
        response = requests.post(movie_create_url, json=movie_create_payload)
        response.raise_for_status()  # Raise an exception for bad status codes

        result = response.json()

        if "data" in result and "movieCreate" in result["data"]:
            movie_data = result["data"]["movieCreate"]
            if movie_data and "id" in movie_data:
                movie_id = movie_data["id"]
                print(f"Movie created successfully with ID: {movie_id}.")
                return movie_id, True
            else:
                print("Error: Unable to retrieve movie ID.")
        else:
            print("Error creating movie:", result.get("errors", "Attempting to create movie..."))
    except requests.exceptions.RequestException as e:
        print(f"Error creating movie: {e}")
    except ValueError as e:
        print(f"Error parsing JSON response: {e}")

    return None, False

# Function to find movie ID by name
def find_movie_id(movie_name):
    find_movie_url = "http://localhost:9999/graphql"
    find_movie_payload = {
        "query": """
            query FindMovieID($name: String!) {
                findMovies(movie_filter: { name: { value: $name, modifier: EQUALS } }) {
                    movies {
                        id
                    }
                }
            }
        """,
        "variables": {
            "name": movie_name
        }
    }
    response = requests.post(find_movie_url, json=find_movie_payload)
    result = response.json()
    if "data" in result and "findMovies" in result["data"] and result["data"]["findMovies"]["movies"]:
        return result["data"]["findMovies"]["movies"][0]["id"]
    else:
        print("Movie not found:", result.get("errors", "Unknown Error"))
        return None

# Function to update scenes with the movie
def update_scenes_with_movie(scene_id, movie_id):
    scene_update_url = "http://localhost:9999/graphql"
    scene_update_payload = {
        "query": """
            mutation SceneUpdate($id: ID!, $movies: [SceneMovieInput!]) {
                sceneUpdate(input: { id: $id, movies: $movies }) {
                    id
                }
            }
        """,
        "variables": {
            "id": scene_id,
            "movies": [{"movie_id": movie_id}]
        }
    }
    response = requests.post(scene_update_url, json=scene_update_payload)
    result = response.json()
    if "data" in result and "sceneUpdate" in result["data"]:
        return result["data"]["sceneUpdate"]["id"], True
    else:
        print("Error updating scene with movie:", result.get("errors", "Unknown Error"))
        return None, False

# Function to parse movie titles
def parse_movie_titles(search_term):
    modified_search_term = re.sub(r'\bscene\b.*', '', search_term, flags=re.IGNORECASE)
    modified_search_term = re.sub(r'\s-.*', '', modified_search_term)
    return modified_search_term.strip()

# Function to perform a custom search for a scene
def perform_custom_search():
    global current_scene_index
    custom_search_term = input("Enter a custom search term: ")
    if current_scene_index < len(scene_ids):
        print(f"Using scene ID '{scene_ids[current_scene_index]}' for custom search.")
    return custom_search_term

# Function to compare fuzzy matched results of the current scene with the previous
def compare_with_previous(matches):
    if previous_search_results:
        for prev_match in previous_search_results:
            for match in matches:
                if match['Name'] == prev_match['Name'] and match['Source'] == prev_match['Source']:
                    return True
    return False

def process_scene_groups(scene_groups, movie_data):
    # Create a copy of scene_groups to iterate over
    scene_groups_copy = scene_groups.copy()
    for subdirectory, group_scenes in scene_groups_copy.items():
        print(f"Subdirectory: {subdirectory}")
        print("Scenes:")
        for i, scene in enumerate(group_scenes, start=1):
            print(f"{i}. {scene['title']}")
        
        handle_user_choice(group_scenes, movie_data)


def find_existing_movie_id(movie_name, movie_data):
    for movie in movie_data:
        if movie['Name'] == movie_name:
            return movie['id']
    return None

def process_existing_movie(existing_movie_id, scene):
    print(f"Movie '{movie_name}' already exists with ID {existing_movie_id}. Adding scenes to this movie.")
    if update_scenes_with_movie(scene['id'], existing_movie_id):
        print(f"Scenes successfully added to movie {existing_movie_id}.")
    else:
        print(f"Failed to add scenes to movie {existing_movie_id}.")

def process_new_movie(movie_name, scene, movie_data):
    global scene_groups  # Declare scene_groups as global

    movie_matches = find_movie_info(movie_name, movie_data)
    match_key = tuple(sorted((match['Name'], match['Source']) for match in movie_matches if match))
    if match_key not in scene_groups:
        scene_groups[match_key] = []
    scene_groups[match_key].append(scene)

def handle_user_choice(group_scenes, movie_data):
    global scene_groups

    # Extract the title of the first scene in the group
    first_scene_title = group_scenes[0]['title']
    # Perform fuzzy search against the local JSON
    movie_matches = find_movie_info(first_scene_title, movie_data)

    # If matches are found, proceed with handling the choices
    if movie_matches:
        handle_movie_matches(movie_matches, group_scenes, movie_data)
    else:
        # If no matches are found, prompt for custom search or to skip
        print("No fuzzy search matches found.")
        custom_search_term = input("Enter a custom search term or press 's' to skip: ")

        # Check if the user wants to skip this movie
        if custom_search_term.strip().lower() == 's':
            print("Skipping to next movie.")
            return

        # Perform a fuzzy search with the custom term
        custom_movie_matches = find_movie_info(custom_search_term, movie_data)
        perform_custom_search(custom_movie_matches, movie_data)

# Global variable to store the scenes of the currently initiated scene group
current_scene_group_scenes = None


# Function to perform a custom search for a scene
def perform_custom_search(custom_movie_matches, movie_data):
    global current_scene_group_scenes  # Ensure access to current_scene_group_scenes

    if not custom_movie_matches:
        print("No matching movies found.")
        return
    
    print("Custom search results:")
    for i, match in enumerate(custom_movie_matches, start=1):
        print(f"{i}. {match['Name']} ({match['Source']})")
    
    while True:
        choice = input("Enter the number of the correct match or 's' to skip: ")
        if choice.lower() == 's':
            return None
        
        try:
            choice_index = int(choice) - 1
            if 0 <= choice_index < len(custom_movie_matches):
                selected_movie = custom_movie_matches[choice_index]
                handle_movie_choice(choice, selected_movie, current_scene_group_scenes, movie_data)  # Pass current_scene_group_scenes here
                return selected_movie
            else:
                print("Invalid choice.")
        except ValueError:
            print("Invalid choice.")

def handle_movie_choice(choice, selected_movie, custom_search_scenes, movie_data):
    # Remove the global declaration for custom_search_scenes
    # global custom_search_scenes

    existing_movie_id = find_movie_id(selected_movie['Name'])
    if existing_movie_id:
        for scene in custom_search_scenes:
            if not update_scenes_with_movie(scene['id'], existing_movie_id):
                print(f"Failed to add scene '{scene['title']}' to movie {existing_movie_id}.")
        print(f"All scenes successfully added to movie {existing_movie_id}.")
    else:
        print("Selected movie not found. Creating a new movie.")
        try:
            movie_url = selected_movie['Source']
        except KeyError:
            print(f"URL for movie '{selected_movie['Name']}' not found in the custom search results.")
            movie_url = input(f"Enter the URL for movie '{selected_movie['Name']}': ")
        created_movie_id, success = create_movie(selected_movie['Name'], movie_url)
        if success:
            for scene in custom_search_scenes:
                if not update_scenes_with_movie(scene['id'], created_movie_id):
                    print(f"Failed to add scene '{scene['title']}' to the newly created movie.")
            print(f"All scenes successfully added to the newly created movie with ID {created_movie_id}.")
        else:
            print("Failed to create a new movie.")

            
# Function to handle movie matches found through fuzzy search
def handle_movie_matches(movie_matches, group_scenes, movie_data):
    global current_scene_group_scenes
    global current_scene_group_key

    print("Fuzzy search results:")
    for i, match in enumerate(movie_matches, start=1):
        print(f"{i}. {match['Name']} ({match['Source']})")
    choice = input("Enter the number of the correct match, 'c' for custom search, 's' to skip, or 'r' to restart: ")
    if choice.lower() == 'c':
        # Preserve the current scene group key for custom search loop
        current_scene_group_key = group_scenes  # Initialize with the current scene group
        current_scene_group_scenes = group_scenes.copy()
        print("Scene Group:")
        for i, scene in enumerate(group_scenes, start=1):
            print(f"{i}. {scene['title']}")
        custom_search_term = input("Enter a custom search term: ")
        custom_movie_matches = find_movie_info(custom_search_term, movie_data)
        perform_custom_search(custom_movie_matches, movie_data)  # Pass movie_data only
    elif choice.lower() == 's':
        print("Skipping group.")
    elif choice.lower() == 'r':
        main()
    else:
        try:
            choice_index = int(choice) - 1
            if 0 <= choice_index < len(movie_matches):
                selected_movie = movie_matches[choice_index]
                # Check if the selected movie has a URL
                if 'Source' in selected_movie:
                    movie_url = selected_movie['Source']
                else:
                    movie_url = input(f"Enter the URL for movie '{selected_movie['Name']}': ")
                selected_movie['Source'] = movie_url  # Add or update the URL in the selected movie
                update_scenes_with_selected_movie(selected_movie, group_scenes)
                # After selecting the movie, update scenes with the selected movie
                movie_id = find_or_create_movie(selected_movie['Name'], movie_url)  # Pass the movie URL
                if movie_id:
                    for scene in group_scenes:
                        if not update_scenes_with_movie(scene['id'], movie_id):
                            print(f"Failed to add scene '{scene['title']}' to movie {movie_id}.")
                    print(f"All scenes successfully added to movie {movie_id}.")
                else:
                    print("Failed to find or create the selected movie.")
            else:
                print("Invalid choice.")
        except ValueError:
            print("Invalid choice.")


def main():
    print("Starting process...")
    studio_id = find_studio_id()
    if not studio_id:
        print("Studio ID not found.")
        return
    
    print(f"Found studio ID: {studio_id}")
    
    scenes = find_scenes(studio_id)
    if not scenes:
        print("No scenes found for the studio.")
        return

    print(f"Found {len(scenes)} scenes.")
    
    try:
        with open('Movie-Fy URLs.json', 'r', encoding='utf-8') as json_file:
            movie_data = json.load(json_file)
    except Exception as e:
        print(f"Error reading JSON file: {e}")
        return

    process_scenes(studio_id, scenes, movie_data)

# Entry point of the program
if __name__ == "__main__":
    main()
         
