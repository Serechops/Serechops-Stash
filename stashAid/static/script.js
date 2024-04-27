document.addEventListener("DOMContentLoaded", function () {
    // Your GraphQL query and API key
    const api_key = 'YOUR_STASHDB_API_KEY'; // Replace with your actual API key
    const url = 'https://stashdb.org/graphql';

    // Calculate the date 7 days ago
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - 7);

    const formattedDate = currentDate.toISOString().split('T')[0]; // Format date as "YYYY-MM-DD"

    // Construct the GraphQL query with the updated date
    const defaultQuery = `
	query QueryScenes {
			queryScenes(
				input: {
					per_page: 27
					date: { value: "${formattedDate}", modifier: GREATER_THAN }
				}
			) {
				scenes {
					title
					release_date
					urls {
						url
					}
					images {
						url
					}
					performers {
						performer {
							name
						}
					}
					tags {
						name
					}
					studio {
						name
					}
				}
			}
		}
    `;

    const favoritesQuery = `
        query QueryFavorites {
            queryScenes(input: { favorites: ALL, per_page: 27 }) {
                scenes {
                    title
                    tags {
                        name
                    }
                    images {
                        url
                    }
                    performers {
                        performer {
                            name
                        }
                    }
                    studio {
                        name
                    }
                }
            }
        }
    `;

    const headers = {
        'Content-Type': 'application/json',
        'ApiKey': api_key
    };

    // Function to create a scene card
    function createSceneCard(scene) {
        const sceneCard = document.createElement("div");
        sceneCard.classList.add("scene-card");

        // Check if scene data exists
        if (!scene) {
            sceneCard.innerHTML = '<p>No data available</p>';
            return sceneCard;
        }

        // Extract performer names and join them with commas
        const performerNames = scene.performers ? scene.performers.map(performer => performer.performer.name).join(', ') : '';

        // Extract tag names and join them with commas
        const tagNames = scene.tags ? scene.tags.map(tag => tag.name).join(', ') : '';

        // Check if scene images exist
        const imageSrc = scene.images && scene.images.length > 0 ? scene.images[0].url : '';
		
		// Extract studio name
		const studioName = scene.studio ? scene.studio.name : 'N/A';
		
		// Extract scene url
		const sceneURL = scene.urls && scene.urls.length > 0 ? scene.urls[0].url : 'N/A';

        // Populate the scene card with data
        sceneCard.innerHTML = `
            <img src="${imageSrc}" alt="Scene Image" class="scene-image">
            <h2>${scene.title || 'N/A'}</h2>
            <p>Tags: ${tagNames || 'N/A'}</p>
            <p>Performers: ${performerNames || 'N/A'}</p>
			<p>Studio: ${studioName || 'N/A'}</p>
            <p>Release Date: ${scene.release_date || 'N/A'}</p>
			<p>Visit: <a href="${sceneURL}" target="_blank" style="color: cyan;">${sceneURL !== 'N/A' ? sceneURL : 'N/A'}</a></p>
			
        `;

        return sceneCard;
    }

    // Function to fetch and populate data based on the selected content type
    function loadContent(contentType) {
        const query = contentType === 'favorites' ? favoritesQuery : defaultQuery;

        // Send a POST request to the GraphQL endpoint
        fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ query: query }),
        })
        .then(response => response.json())
        .then(data => {
            const sceneList = document.getElementById("sceneList");

            // Clear existing content
            sceneList.innerHTML = '';

            if (data.data && data.data.queryScenes && data.data.queryScenes.scenes) {
                const scenes = data.data.queryScenes.scenes;

                scenes.forEach(scene => {
                    // Create a scene card element
                    const sceneCard = createSceneCard(scene);

                    // Add the scene card to the grid
                    sceneList.appendChild(sceneCard);
                });
            }
        })
        .catch(error => {
            console.error("Error fetching data:", error);
        });
    }

    // Initialize content with the default query
    loadContent('default');

    // Listen for changes in the dropdown selection
    const contentSelector = document.getElementById("contentSelector");
    contentSelector.addEventListener("change", function () {
        const selectedContentType = contentSelector.value;
        loadContent(selectedContentType);
    });

});
