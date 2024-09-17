(async function() {
    'use strict';

    // Dynamically load Toastify CSS
    const toastifyCSS = document.createElement('link');
    toastifyCSS.rel = 'stylesheet';
    toastifyCSS.href = 'https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css';
    document.head.appendChild(toastifyCSS);

    // Inject custom CSS for the custom menu
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        #tags-custom-menu {
            background-color: #000;
            background: rgba(0, 0, 0, 0.3);
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            position: absolute;
            border: 1px solid #ccc;
            z-index: 10000;
            padding: 10px;
        }

        #tags-custom-menu a {
            display: block;
            margin-bottom: 5px;
            color: white;
        }

        .tags-loading-header {
            outline: 1px solid black;
            background: rgba(0, 0, 0, 0.5);
        }
    `;
    document.head.appendChild(styleElement);

    // Function to extract tag ID from the URL
    function getTagID(url) {
        const urlParts = url.split('/');
        return urlParts[urlParts.length - 1];
    }

    // Function to auto-tag tag
    async function autoTag(tagID) {
        const mutation = `
            mutation MetadataAutoTag {
                metadataAutoTag(input: { tags: "${tagID}" })
            }
        `;
        try {
            const response = await graphqlRequest(mutation);
            if (response && response.data && response.data.metadataAutoTag) {
                Toastify({
                    text: 'Auto-tagging completed successfully',
                    backgroundColor: 'green',
                    position: "center",
                    duration: 3000
                }).showToast();
                return response.data.metadataAutoTag;
            } else {
                Toastify({
                    text: 'Failed to auto-tag tag',
                    backgroundColor: 'red',
                    position: "center",
                    duration: 3000
                }).showToast();
                return null;
            }
        } catch (error) {
            Toastify({
                text: 'Error auto-tagging tag',
                backgroundColor: 'red',
                position: "center",
                duration: 3000
            }).showToast();
            console.error('Error auto-tagging tag:', error);
            return null;
        }
    }

    // Function to delete a tag and its markers
    async function deleteTag(tagID) {
        const findMarkersQuery = `
            query FindSceneMarkers {
                findSceneMarkers(
                    scene_marker_filter: { tags: { value: "${tagID}", modifier: EQUALS } }
                    filter: { per_page: -1 }
                ) {
                    scene_markers {
                        id
                        title
                        primary_tag {
                            id
                            name
                        }
                    }
                }
            }
        `;

        try {
            const markersResponse = await graphqlRequest(findMarkersQuery);
            if (markersResponse && markersResponse.data && markersResponse.data.findSceneMarkers) {
                const markers = markersResponse.data.findSceneMarkers.scene_markers;
                for (const marker of markers) {
                    if (marker.primary_tag.id === tagID) {
                        await deleteMarker(marker.id);
                    }
                }
                await deleteTagMutation(tagID);
                Toastify({
                    text: 'Tag and its markers deleted successfully',
                    backgroundColor: 'green',
                    position: "center",
                    duration: 3000
                }).showToast();
            } else {
                Toastify({
                    text: 'No markers found for this tag',
                    backgroundColor: 'orange',
                    position: "center",
                    duration: 3000
                }).showToast();
            }
        } catch (error) {
            Toastify({
                text: 'Error deleting tag',
                backgroundColor: 'red',
                position: "center",
                duration: 3000
            }).showToast();
            console.error('Error deleting tag:', error);
        }
    }

    // Function to delete a marker
    async function deleteMarker(markerID) {
        const mutation = `
            mutation SceneMarkerDestroy {
                sceneMarkerDestroy(id: ${markerID})
            }
        `;
        try {
            const response = await graphqlRequest(mutation);
            if (response && response.data && response.data.sceneMarkerDestroy) {
                return response.data.sceneMarkerDestroy;
            } else {
                console.error('Failed to delete marker:', markerID);
                return null;
            }
        } catch (error) {
            console.error('Error deleting marker:', error);
            return null;
        }
    }

    // Function to delete a tag
    async function deleteTagMutation(tagID) {
        const mutation = `
            mutation TagDestroy {
                tagDestroy(input: { id: "${tagID}" })
            }
        `;
        try {
            const response = await graphqlRequest(mutation);
            if (response && response.data && response.data.tagDestroy) {
                return response.data.tagDestroy;
            } else {
                console.error('Failed to delete tag:', tagID);
                return null;
            }
        } catch (error) {
            console.error('Error deleting tag:', error);
            return null;
        }
    }

    // Function to create the custom menu
    function createCustomMenu(tagID) {
        const menu = document.createElement('div');
        menu.id = 'tags-custom-menu';

        const autoTagLink = document.createElement('a');
        autoTagLink.href = '#';
        autoTagLink.textContent = 'Auto-Tag...';
        autoTagLink.addEventListener('click', async function(e) {
            e.preventDefault();
            await autoTag(tagID);
        });
        menu.appendChild(autoTagLink);

        const deleteTagLink = document.createElement('a');
        deleteTagLink.href = '#';
        deleteTagLink.textContent = 'Delete Tag...';
        deleteTagLink.addEventListener('click', async function(e) {
            e.preventDefault();
            await deleteTag(tagID);
        });
        menu.appendChild(deleteTagLink);

        // Add Support link at the bottom of the menu
        const supportLink = document.createElement('a');
        supportLink.href = 'https://www.patreon.com/serechops/membership';
        supportLink.textContent = 'Support';
        supportLink.target = '_blank'; // Open in a new tab
        supportLink.style.marginTop = '10px';
        supportLink.style.color = '#FFD700';
        menu.appendChild(supportLink);

        document.body.appendChild(menu);
        return menu;
    }

    // Function to show the custom menu
    function showCustomMenu(event, tagID) {
        if (currentMenu) currentMenu.remove();
        const menu = createCustomMenu(tagID);
        menu.style.top = `${event.pageY}px`;
        menu.style.left = `${event.pageX}px`;
        event.preventDefault();

        const handleClickOutside = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                currentMenu = null;
                document.removeEventListener('click', handleClickOutside);
            }
        };

        document.addEventListener('click', handleClickOutside);
        currentMenu = menu;
    }

    // Function to handle right-click on tag cards
    document.addEventListener('contextmenu', function(event) {
        const tagCard = event.target.closest('.tag-card');
        if (tagCard) {
            const tagLink = tagCard.querySelector('.tag-card-header');
            if (tagLink) {
                const tagID = getTagID(tagLink.href);
                if (tagID) showCustomMenu(event, tagID);
            }
        }
    });

    // GraphQL request function
    async function graphqlRequest(query, variables = {}) {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, variables })
        });
        return response.json();
    }

    // Store the currently opened right-click menu to close it if another right-click occurs
    let currentMenu = null;

})();
