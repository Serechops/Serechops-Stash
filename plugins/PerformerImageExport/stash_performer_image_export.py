import os
import requests
import sys

def download_performer_images(download_dir):
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

    else:
        print(f"Failed to query API. Status Code: {response.status_code}")

if __name__ == "__main__":
    # Check if a command-line argument for the mode is provided
    if len(sys.argv) > 1:
        mode = sys.argv[1]
    else:
        # Default mode if not provided as an argument
        mode = "manual"

    if mode == "manual":
        # Run the script in manual mode
        download_performer_images("Performer Image Export")
    elif mode == "some_other_mode":
        # Add more modes if needed
        pass
