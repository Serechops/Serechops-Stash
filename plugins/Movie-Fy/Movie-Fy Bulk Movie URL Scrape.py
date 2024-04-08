import requests
import stashapi.log as log

# GraphQL queries
all_movies_query = """
query AllMovies {
    allMovies {
        id
        name
        url
    }
}
"""

scrape_movie_query = """
query ScrapeMovieURL($url: String!) {
    scrapeMovieURL(url: $url) {
        name
        date
        synopsis
        front_image
        back_image
    }
}
"""

movie_update_mutation = """
mutation MovieUpdate($id: ID!, $name: String!, $date: String!, $synopsis: String!, $front_image: String!, $back_image: String!) {
    movieUpdate(input: {
        id: $id
        name: $name
        date: $date
        synopsis: $synopsis
        front_image: $front_image
        back_image: $back_image
    }) {
        id
    }
}
"""

# GraphQL endpoint
graphql_endpoint = "http://localhost:9999/graphql"

# Function to send GraphQL queries
def send_query(query, variables=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    response = requests.post(graphql_endpoint, json=payload)
    return response.json()

if __name__ == "__main__":
    # Step 1: Fetch all movies and their URLs
    response = send_query(all_movies_query)
    movies = response["data"]["allMovies"]
    total_movies = len(movies)
    processed_movies = 0

    log.info("Scraping and updating movies...")

    # Iterating through movies
    for movie in movies:
        movie_id = movie["id"]
        movie_name = movie["name"]
        movie_url = movie["url"]
        
        if not movie_url:
            log.warning(f"Skipping movie '{movie_name}' due to blank URL.")
            continue

        # Step 3: Send GraphQL query to scrape metadata
        scrape_variables = {"url": movie_url}
        scrape_response = send_query(scrape_movie_query, variables=scrape_variables)
        scraped_data = scrape_response["data"]["scrapeMovieURL"]
        
        # Step 4: Extract scraped metadata
        name = scraped_data.get("name", "")
        date = scraped_data.get("date", "")
        synopsis = scraped_data.get("synopsis", "")
        front_image = scraped_data.get("front_image", "")
        back_image = scraped_data.get("back_image", "")

        # Step 5: Send GraphQL mutation to update movie record
        update_variables = {
            "id": movie_id,
            "name": name,
            "date": date,
            "synopsis": synopsis,
            "front_image": front_image,
            "back_image": back_image
        }
        update_response = send_query(movie_update_mutation, variables=update_variables)
        if "errors" in update_response:
            log.error(f"Failed to update movie {movie_name}: {update_response['errors']}")
        else:
            log.info(f"Movie {movie_name} (ID: {movie_id}) updated successfully.")  # Log the name and ID of the updated movie

        # Update progress
        processed_movies += 1
        progress = processed_movies / total_movies
        log.progress(progress)

    log.info("All movies scraped and updated successfully.")
