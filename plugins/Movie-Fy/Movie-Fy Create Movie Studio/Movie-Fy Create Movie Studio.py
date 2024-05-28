import sys
import requests
import stashapi.log as log  # Importing log module

# Function to create a new Movie Studio or retrieve an existing one
def create_movie_studio():
    studio_create_url = "http://localhost:9999/graphql"  # Replace with the actual Stash API endpoint for studio creation

    studio_create_payload = {
        "query": """
            mutation StudioCreate {
                studioCreate(
                    input: {
                        name: "Movie"
                        image: "https://m.media-amazon.com/images/I/71WDJzIx86L.jpg"
                    }
                ) {
                    id
                }
            }
        """
    }

    try:
        response = requests.post(studio_create_url, json=studio_create_payload)
        response.raise_for_status()  # Raise an error for bad responses (4xx and 5xx)

        result = response.json()

        if "data" in result and "studioCreate" in result["data"]:
            return result["data"]["studioCreate"]["id"]
        else:
            log.error("Error creating movie studio:", result.get("errors"))
            return None

    except requests.exceptions.HTTPError as e:
        if response.status_code == 400:
            # Assuming a 400 status code indicates that the studio already exists
            log.info("Movie studio already exists.")
            return None
        else:
            log.error(f"HTTP error during studio creation: {e}")
            return None

    except Exception as e:
        log.error(f"An unexpected error occurred: {e}")
        return None

if __name__ == "__main__":
    # Step 1: Create a new Movie Studio or retrieve an existing one
    studio_id = create_movie_studio()

    if studio_id is not None:
        log.info("Created or retrieved Movie Studio with ID:", studio_id)
    else:
        log.error("Failed to create or retrieve movie studio.")
