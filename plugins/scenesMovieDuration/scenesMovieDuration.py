import requests
import stashapi.log as log

# Define your GraphQL query and mutation
query = '''
    query AllMovies {
        allMovies {
            id
            name
            duration
            scenes {
                id
                files {
                    duration
                }
            }
        }
    }
'''

mutation = '''
    mutation MovieUpdate($movieId: ID!, $duration: Int!) {
        movieUpdate(input: { id: $movieId, duration: $duration}) {
            duration
            id
        }
    }
'''

def execute_query(url, query):
    response = requests.post(url, json={'query': query})
    response.raise_for_status()
    return response.json()

def execute_mutation(url, mutation, variables):
    response = requests.post(url, json={'query': mutation, 'variables': variables})
    response.raise_for_status()
    return response.json()['data']['movieUpdate']

def update_movie_duration(url, movie_id, duration):
    rounded_duration = round(duration)
    mutation_variables = {"movieId": movie_id, "duration": rounded_duration}
    return execute_mutation(url, mutation, mutation_variables)

def calculate_scene_duration(movie):
    total_duration = 0  # Initialize total duration as 0
    for scene in movie['scenes']:
        for file in scene['files']:
            duration = file.get('duration', 0)  # Get duration if it exists, otherwise default to 0
            total_duration += duration
    return total_duration

def format_duration(seconds):
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

def main():
    graphql_url = 'http://localhost:9999/graphql'

    # Execute the query to fetch all movies
    try:
        result = execute_query(graphql_url, query)
    except Exception as e:
        log.error(f"Error executing GraphQL query: {e}")
        return

    # Process each movie
    for movie in result['data']['allMovies']:
        movie_id = movie['id']
        movie_name = movie['name']
        movie_duration = movie['duration']
        
        # Skip the movie if it already has a duration set
        if movie_duration is not None:
            log.info(f"Skipping movie {movie_name} (ID: {movie_id}) as it already has a duration set.")
            continue
        
        total_duration = calculate_scene_duration(movie)

        # Update the movie's duration with the calculated sum
        try:
            updated_movie = update_movie_duration(graphql_url, movie_id, total_duration)
            formatted_duration = format_duration(updated_movie['duration'])
            log.info(f"Updated movie: {movie_name}, New Duration: {formatted_duration}")
        except Exception as e:
            log.error(f"Error updating movie {movie_id}: {e}")

if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
