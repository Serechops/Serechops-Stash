import os
import requests
import sys

def download_performer_images(download_dir, server_url):
    # Define the GraphQL query
    graphql_query = """
    query AllPerformers {
        allPerformers {
            name
            image_path
        }
    }
    """

    # Set the GraphQL endpoint URL
    graphql_url = "http://localhost:9999/graphql"

    # Make a POST request to the GraphQL API
    response = requests.post(graphql_url, json={'query': graphql_query})

    # Check if the request was successful (status code 200)
    if response.status_code == 200:
        data = response.json()

        # Get the directory of the current script
        script_directory = os.path.dirname(__file__)

        # Create a downloads directory in the script directory
        download_dir = os.path.join(script_directory, download_dir)
        os.makedirs(download_dir, exist_ok=True)

        # Flag to track successful image downloads
        all_downloaded = True

        # Loop through the performers and download their images
        for performer in data['data']['allPerformers']:
            name = performer['name']
            image_path = performer['image_path']

            # Extract the filename from the image path
            filename = os.path.join(download_dir, f"{name}.jpg")

            # Download the image
            image_response = requests.get(image_path)

            # Check if the image download was successful
            if image_response.status_code == 200:
                with open(filename, 'wb') as f:
                    f.write(image_response.content)
                print(f"Downloaded {filename}")
            else:
                print(f"Failed to download image for performer {name}")
                all_downloaded = False  # Mark as not all images downloaded successfully

        # Check if all images were downloaded successfully
        if all_downloaded:
            print("All performer images downloaded successfully. Informing server.")
            # Inform server of successful completion
            try:
                requests.post(server_url)
            except Exception as e:
                print(f"Failed to inform server: {e}")

    else:
        print(f"Failed to query API. Status Code: {response.status_code}")

if __name__ == "__main__":
    # Define Flask server URL
    server_url = "http://localhost:5000/script_finished"
    # Run the script to download performer images
    download_performer_images("Performer Image Export", server_url)
    # After script completion
    requests.post('http://localhost:5000/script_completed', json={'script_type': 'python'})
