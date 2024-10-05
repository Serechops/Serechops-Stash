// Main script IIFE
(async function() {
    'use strict';

    // Configuration object with default values
    const config = {
        serverUrl: `/graphql`, // Relative URL for local GraphQL endpoint
        localApiKey: '', // Will be updated after fetching configuration
        stashDBApiKey: '',
        stashDBEndpoint: "https://stashdb.org/graphql",
        tpdbApiKey: '',
        tpdbEndpoint: '',
        fansdbApiKey: '',
        fansdbEndpoint: "https://fansdb.cc/graphql",
        stashBoxNames: {} // This will map endpoints to user-friendly names dynamically
    };

    // Fetch configuration for API keys and endpoints
    async function fetchConfiguration() {
        const configQuery = `
            query Configuration {
                configuration {
                    general {
                        stashBoxes {
                            endpoint
                            api_key
                            name
                        }
                        apiKey
                    }
                }
            }
        `;
        try {
            const response = await fetch(config.serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: configQuery })
            }).then(res => res.json());

            if (response && response.data && response.data.configuration) {
                return {
                    stashBoxes: response.data.configuration.general.stashBoxes,
                    localApiKey: response.data.configuration.general.apiKey,
                };
            } else {
                console.error('Failed to fetch configuration');
                return {
                    stashBoxes: [],
                    localApiKey: '',
                };
            }
        } catch (error) {
            console.error('Error fetching configuration:', error);
            return {
                stashBoxes: [],
                localApiKey: '',
            };
        }
    }

    // Fetch the configuration and update config object
    const configData = await fetchConfiguration();
    const stashBoxes = configData.stashBoxes;

    // Update configuration with API keys and endpoints, and create the friendly names dynamically
    stashBoxes.forEach(box => {
        config.stashBoxNames[box.endpoint] = box.name;
        if (box.endpoint === config.stashDBEndpoint) {
            config.stashDBApiKey = box.api_key;
        }
        if (box.endpoint.startsWith("https://theporndb.net/graphql")) {
            config.tpdbApiKey = box.api_key;
            config.tpdbEndpoint = box.endpoint;
        }
        if (box.endpoint === config.fansdbEndpoint || box.endpoint === "https://fansdb.xyz/graphql") {
            config.fansdbApiKey = box.api_key;
        }
    });

    config.localApiKey = configData?.localApiKey ?? '';

    // Dynamically load Toastify CSS
    const toastifyCSS = document.createElement('link');
    toastifyCSS.rel = 'stylesheet';
    toastifyCSS.href = 'https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css';
    document.head.appendChild(toastifyCSS);

    // Dynamically load Tabulator CSS
    const tabulatorCSS = document.createElement('link');
    tabulatorCSS.rel = 'stylesheet';
    tabulatorCSS.href = 'https://unpkg.com/tabulator-tables@5.0.8/dist/css/tabulator_midnight.min.css';
    document.head.appendChild(tabulatorCSS);

    // Wait for Toastify to be defined
    function waitForToastify() {
        return new Promise((resolve) => {
            const checkToastify = setInterval(() => {
                if (typeof Toastify !== 'undefined') {
                    clearInterval(checkToastify);
                    resolve();
                }
            }, 100);
        });
    }

    // Wait for Toastify to load
    await waitForToastify();

    // Example of using Toastify
    function showToast(message, type = "success") {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "center",
            backgroundColor: type === "success" ? "green" : "red",
        }).showToast();
    }

    // GraphQL fetch function using dynamic API key
    const fetchGQL = async (query, variables = {}) =>
        fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ApiKey': config.localApiKey
            },
            body: JSON.stringify({ query, variables })
        }).then(res => res.json());

    // Store the currently opened right-click menu to close it if another right-click occurs
    let currentMenu = null;
    let currentPopup = null;

    // Function to create the custom menu
    function createCustomMenu(imageId, galleries) {
        const menu = document.createElement('div');
        menu.id = 'custom-menu';
        menu.style.position = 'absolute';
        menu.style.backgroundColor = '#000000';
        menu.style.border = '1px solid #ccc';
        menu.style.zIndex = '10000';
        menu.style.padding = '10px';
        menu.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';

        const viewLink = document.createElement('a');
        viewLink.href = `/images/${imageId}`;
        viewLink.textContent = 'View Image';
        viewLink.style.display = 'block';
        viewLink.style.marginBottom = '5px';
        menu.appendChild(viewLink);

        const addTagsLink = document.createElement('a');
        addTagsLink.href = '#';
        addTagsLink.textContent = 'Add Tags...';
        addTagsLink.style.display = 'block';
        addTagsLink.style.marginBottom = '5px';
        addTagsLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Tags', imageId, fetchTags, e);
        });
        menu.appendChild(addTagsLink);

        const addPerformersLink = document.createElement('a');
        addPerformersLink.href = '#';
        addPerformersLink.textContent = 'Add Performers...';
        addPerformersLink.style.display = 'block';
        addPerformersLink.style.marginBottom = '5px';
        addPerformersLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Performers', imageId, fetchPerformers, e);
        });
        menu.appendChild(addPerformersLink);

        const linkSceneLink = document.createElement('a');
        linkSceneLink.href = '#';
        linkSceneLink.textContent = 'Link Scene...';
        linkSceneLink.style.display = 'block';
        linkSceneLink.style.marginBottom = '5px';
        linkSceneLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Scenes', imageId, fetchScenes, e);
        });
        menu.appendChild(linkSceneLink);

        const updatePerformerImageLink = document.createElement('a');
        updatePerformerImageLink.href = '#';
        updatePerformerImageLink.textContent = 'Update Performer Image...';
        updatePerformerImageLink.style.display = 'block';
        updatePerformerImageLink.style.marginBottom = '5px';
        updatePerformerImageLink.addEventListener('click', async function(e) {
            e.preventDefault();
            await updatePerformerImage(imageId, menu);
        });
        menu.appendChild(updatePerformerImageLink);

        // Conditionally show the "Set Gallery Cover Image..." option
        if (galleries && galleries.length > 0) {
            const setGalleryCoverLink = document.createElement('a');
            setGalleryCoverLink.href = '#';
            setGalleryCoverLink.textContent = 'Set Gallery Cover Image...';
            setGalleryCoverLink.style.display = 'block';
            setGalleryCoverLink.style.marginBottom = '5px';
            setGalleryCoverLink.addEventListener('click', async function(e) {
                e.preventDefault();
                await setGalleryCoverImage(imageId, galleries[0].id, menu); // Use the first gallery for simplicity
            });
            menu.appendChild(setGalleryCoverLink);
        }

        // Add Support link at the bottom of the menu with target="_blank"
        const supportLink = document.createElement('a');
        supportLink.href = 'https://www.patreon.com/serechops/membership';
        supportLink.textContent = 'Support';
        supportLink.style.display = 'block';
        supportLink.style.marginTop = '10px';
        supportLink.style.color = '#FFD700';
        supportLink.target = '_blank'; // Opens the link in a new tab
        menu.appendChild(supportLink);

        document.body.appendChild(menu);
        currentMenu = menu;
        return menu;
    }

    // Function to show the custom menu
    async function showCustomMenu(event, imageId) {
        if (currentMenu) {
            currentMenu.remove();
        }
        if (currentPopup) {
            currentPopup.remove();
        }

        // Fetch galleries associated with the image
        const galleries = await fetchImageGalleries(imageId);

        const menu = createCustomMenu(imageId, galleries);
        menu.style.top = `${event.pageY}px`;
        menu.style.left = `${event.pageX}px`;
        event.preventDefault();

        const handleClickOutside = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', handleClickOutside);
            }
        };

        document.addEventListener('click', handleClickOutside);
    }

    // Function to extract image ID from URL
function getImageIdFromUrl(url) {
    const match = url.match(/images\/(\d+)/); // Update regex based on actual URL pattern
    if (match) {
        console.log('Extracted Image ID:', match[1]);
        return match[1];
    } else {
        console.error('Failed to extract image ID from URL:', url);
        return null;
    }
}


    // Debounce function to limit the rate at which a function can fire
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Function to create the Tabulator table in a popup
    function createTabulatorPopup(type, imageId, fetchFunction, event) {
        console.log(`Creating Tabulator popup for ${type}`);
        const popup = document.createElement('div');
        popup.id = 'popup';
        document.body.appendChild(popup);

        const form = document.createElement('form');
        form.innerHTML = `
            <h2>Add ${type} to Image</h2>
            <input type="text" id="${type.toLowerCase()}-search" placeholder="Search ${type}">
            <div id="${type.toLowerCase()}-table"></div>
            <button type="button" id="add-${type.toLowerCase()}">Add ${type}</button>
            <button type="button" id="cancel">Cancel</button>
        `;
        popup.appendChild(form);
        currentPopup = popup;

        const tableColumns = [
            { title: "ID", field: "id" },
            { title: type === 'Scenes' ? 'Title' : 'Name', field: type === 'Scenes' ? 'title' : 'name' }
        ];

        if (type === 'Performers') {
            tableColumns.push({ title: "Disambiguation", field: "disambiguation" });
        }

        const table = new Tabulator(`#${type.toLowerCase()}-table`, {
            layout: "fitColumns",
            height: "300px",
            placeholder: "No Data Available",
            selectable: true,
            columns: tableColumns
        });

        async function fetchData(query) {
            const data = await fetchFunction(query);
            table.setData(data);
        }

        const filterInput = document.getElementById(`${type.toLowerCase()}-search`);
        filterInput.addEventListener('input', debounce((e) => {
            const query = e.target.value;
            fetchData(query);
        }, 300));

        document.getElementById(`add-${type.toLowerCase()}`).addEventListener('click', async function() {
            const selectedRows = table.getSelectedData();
            const selectedIds = selectedRows.map(row => row.id);
            if (type === 'Tags') {
                await updateImageWithTags(imageId, selectedIds);
            } else if (type === 'Performers') {
                await updateImageWithPerformers(imageId, selectedIds);
            } else if (type === 'Scenes') {
                await linkSceneToImage(imageId, selectedIds);
            }
            popup.remove();
        });

        document.getElementById('cancel').addEventListener('click', function() {
            popup.remove();
        });

        const rect = popup.getBoundingClientRect();
        const menuRect = currentMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (menuRect.right + rect.width > viewportWidth) {
            popup.style.left = `${menuRect.left - rect.width}px`;
        } else {
            popup.style.left = `${menuRect.right}px`;
        }

        if (menuRect.top + rect.height > viewportHeight) {
            popup.style.top = `${viewportHeight - rect.height}px`;
        } else {
            popup.style.top = `${menuRect.top}px`;
        }
    }

    // Function to fetch tags matching a query
    async function fetchTags(query) {
        const queryText = `
            query FindTags($filter: String!) {
                findTags(tag_filter: { name: { value: $filter, modifier: INCLUDES } }, filter: { per_page: -1 }) {
                    tags {
                        id
                        name
                    }
                }
            }
        `;
        const response = await fetchGQL(queryText, { filter: query });
        return response.data.findTags.tags;
    }

    // Function to fetch performers matching a query
    async function fetchPerformers(query) {
        const queryText = `
            query FindPerformers($filter: String!) {
                findPerformers(performer_filter: { name: { value: $filter, modifier: INCLUDES } }, filter: { per_page: -1 }) {
                    performers {
                        id
                        name
                        disambiguation
                    }
                }
            }
        `;
        const response = await fetchGQL(queryText, { filter: query });
        return response.data.findPerformers.performers;
    }

    // Function to fetch scenes matching a query
    async function fetchScenes(query) {
        const queryText = `
            query FindScenes($filter: String!) {
                findScenes(scene_filter: { title: { value: $filter, modifier: INCLUDES } }, filter: { per_page: -1, direction: ASC }) {
                    scenes {
                        id
                        title
                    }
                }
            }
        `;
        const response = await fetchGQL(queryText, { filter: query });
        return response.data.findScenes.scenes;
    }

    // Function to update the image with selected tags using GraphQL
    async function updateImageWithTags(imageId, newTagIds) {
        const existingTagsQuery = `
            query FindImage {
                findImage(id: ${imageId}) {
                    tags {
                        id
                    }
                }
            }
        `;

        const existingTagsResponse = await fetchGQL(existingTagsQuery);
        const existingTagIds = existingTagsResponse.data.findImage.tags.map(tag => tag.id);
        const combinedTagIds = Array.from(new Set([...existingTagIds, ...newTagIds]));

        const mutationQuery = `
            mutation ImageUpdate {
                imageUpdate(input: { id: "${imageId}", tag_ids: ${JSON.stringify(combinedTagIds)} }) {
                    id
                }
            }
        `;

        try {
            const response = await fetchGQL(mutationQuery);
            if (response.errors) {
                showToast('Failed to update the image with tags', 'error');
            } else {
                showToast('Image updated with tags successfully', 'success');
            }
        } catch (error) {
            showToast('Failed to update the image with tags', 'error');
        }
    }

    // Function to update the image with selected performers using GraphQL
    async function updateImageWithPerformers(imageId, newPerformerIds) {
        const existingPerformersQuery = `
            query FindImage {
                findImage(id: ${imageId}) {
                    performers {
                        id
                    }
                }
            }
        `;

        const existingPerformersResponse = await fetchGQL(existingPerformersQuery);
        const existingPerformerIds = existingPerformersResponse.data.findImage.performers.map(performer => performer.id);
        const combinedPerformerIds = Array.from(new Set([...existingPerformerIds, ...newPerformerIds]));

        const mutationQuery = `
            mutation ImageUpdate {
                imageUpdate(input: { id: "${imageId}", performer_ids: ${JSON.stringify(combinedPerformerIds)} }) {
                    id
                }
            }
        `;

        try {
            const response = await fetchGQL(mutationQuery);
            if (response.errors) {
                showToast('Failed to update the image with performers', 'error');
            } else {
                showToast('Image updated with performers successfully', 'success');
            }
        } catch (error) {
            showToast('Failed to update the image with performers', 'error');
        }
    }

    // Function to link a scene to the image and create a gallery using GraphQL
    async function linkSceneToImage(imageId, selectedSceneIds) {
        for (let sceneId of selectedSceneIds) {
            try {
                const sceneQuery = `
                    query FindScene($id: ID!) {
                        findScene(id: $id) {
                            title
                        }
                    }
                `;
                const sceneResponse = await fetchGQL(sceneQuery, { id: sceneId });
                const sceneTitle = sceneResponse.data.findScene.title;

                const galleryId = await createGallery(sceneTitle);

                await updateImage(imageId, galleryId);
                await updateScene(sceneId, galleryId);

                showToast(`Image gallery created for scene ${sceneTitle} successfully`, 'success');
            } catch (error) {
                showToast('Failed to link scene to image', 'error');
            }
        }
    }

    // Function to create a gallery
    async function createGallery(galleryTitle) {
        const mutation = `
            mutation GalleryCreate($input: GalleryCreateInput!) {
                galleryCreate(input: $input) {
                    id
                }
            }
        `;

        try {
            const response = await fetchGQL(mutation, { input: { title: galleryTitle } });
            return response.data.galleryCreate.id;
        } catch (error) {
            throw new Error('Error creating gallery');
        }
    }

    // Function to update an image with a gallery ID
    async function updateImage(imageId, galleryId) {
        const mutation = `
            mutation ImageUpdate($input: ImageUpdateInput!) {
                imageUpdate(input: $input) {
                    id
                }
            }
        `;

        try {
            const response = await fetchGQL(mutation, { input: { id: imageId, gallery_ids: [galleryId] } });
            return response.data.imageUpdate.id;
        } catch (error) {
            throw new Error('Error updating image');
        }
    }

    // Function to fetch galleries linked to the image
    async function fetchImageGalleries(imageId) {
        const query = `
            query FindImage($id: ID!) {
                findImage(id: $id) {
                    galleries {
                        id
                        title
                    }
                }
            }
        `;
        const response = await fetchGQL(query, { id: imageId });
        return response.data.findImage.galleries;
    }

    // Function to set the gallery cover image
async function setGalleryCoverImage(imageId, galleryId, menu) {
    console.log('Setting gallery cover image...');
    console.log('Image ID:', imageId);
    console.log('Gallery ID:', galleryId);

    const mutation = `
        mutation SetGalleryCover($gallery_id: ID!, $cover_image_id: ID!) {
            setGalleryCover(input: { gallery_id: $gallery_id, cover_image_id: $cover_image_id })
        }
    `;
    
    try {
        const response = await fetchGQL(mutation, {
            gallery_id: galleryId,
            cover_image_id: imageId
        });

        // Check if the response returns true (mutation successful)
        if (response.errors) {
            console.error('GraphQL Errors:', response.errors);
            showToast('Failed to set gallery cover image', 'error');
        } else {
            console.log('Gallery cover image set successfully');
            showToast('Gallery cover image set successfully', 'success');
        }
    } catch (error) {
        console.error('Failed to set gallery cover image:', error);
        showToast('Failed to set gallery cover image', 'error');
    }
}



    // Function to update a scene with a gallery ID
    async function updateScene(sceneId, galleryId) {
        const mutation = `
            mutation SceneUpdate($input: SceneUpdateInput!) {
                sceneUpdate(input: $input) {
                    id
                }
            }
        `;

        try {
            const response = await fetchGQL(mutation, { input: { id: sceneId, gallery_ids: [galleryId] } });
            return response.data.sceneUpdate.id;
        } catch (error) {
            throw new Error('Error updating scene');
        }
    }

    // Function to update performer image
    async function updatePerformerImage(imageId, menu) {
        try {
            // Fetch the image URL and associated performers
            const imageQuery = `
                query FindImage {
                    findImage(id: ${imageId}) {
                        paths {
                            image
                        }
                        performers {
                            id
                            name
                        }
                        galleries {
                            performers {
                                id
                                name
                            }
                        }
                    }
                }
            `;
            const imageResponse = await fetchGQL(imageQuery);
            const imageUrl = imageResponse.data.findImage.paths.image;
            const img_performers = imageResponse.data.findImage.performers;
            const gal_performers = imageResponse.data.findImage.galleries[0]?.performers || [];
            let performers = img_performers.length ? img_performers : gal_performers;

            if (performers.length === 0) {
                showToast('No performers linked to this image.', 'error');
                return;
            }

            if (performers.length === 1) {
                const performer = performers[0];
                const mutation = `
                    mutation PerformerUpdate {
                        performerUpdate(input: { id: "${performer.id}", image: "${imageUrl}" }) {
                            id
                        }
                    }
                `;
                const response = await fetchGQL(mutation);
                if (response.errors) {
                    showToast('Failed to update performer image', 'error');
                } else {
                    showToast(`Performer image updated successfully for ${performer.name}`, 'success');
                }
            } else {
                const selectedPerformer = await showPerformerSelectionPopup(performers, menu);
                if (selectedPerformer) {
                    const mutation = `
                        mutation PerformerUpdate {
                            performerUpdate(input: { id: "${selectedPerformer.id}", image: "${imageUrl}" }) {
                                id
                            }
                        }
                    `;
                    const response = await fetchGQL(mutation);
                    if (response.errors) {
                        showToast('Failed to update performer image', 'error');
                    } else {
                        showToast(`Performer image updated successfully for ${selectedPerformer.name}`, 'success');
                    }
                }
            }
        } catch (error) {
            showToast('Failed to update performer image', 'error');
        }
    }

    // Function to show performer selection popup
    async function showPerformerSelectionPopup(performers, menu) {
        return new Promise((resolve) => {
            const popup = document.createElement('div');
            popup.id = 'popup';
            document.body.appendChild(popup);

            const form = document.createElement('form');
            form.innerHTML = `
                <h2>Select Performer</h2>
                <select id="performer-select">
                    ${performers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
                <button type="button" id="select-performer">Select</button>
                <button type="button" id="cancel-performer">Cancel</button>
            `;
            popup.appendChild(form);

            document.getElementById('select-performer').addEventListener('click', function() {
                const selectedId = document.getElementById('performer-select').value;
                const selectedPerformer = performers.find(p => p.id === selectedId);
                popup.remove();
                resolve(selectedPerformer);
            });

            document.getElementById('cancel-performer').addEventListener('click', function() {
                popup.remove();
                resolve(null);
            });

            const menuRect = menu.getBoundingClientRect();
            popup.style.top = `${menuRect.bottom}px`;
            popup.style.left = `${menuRect.left}px`;
        });
    }

    // Add event listener to .image-card elements
document.addEventListener('contextmenu', function(event) {
    const imageCard = event.target.closest('.image-card');
    
    // Check if the right-click is on an image card element
    if (imageCard) {
        // Prevent the default browser right-click context menu
        event.preventDefault();

        const linkElement = imageCard.querySelector('.image-card-link');
        if (linkElement) {
            const imageId = getImageIdFromUrl(linkElement.href);
            if (imageId) {
                showCustomMenu(event, imageId);
            }
        }
    } 
    // If it's not an image-card element, let the default context menu appear
    else {
        return; // Allow default right-click behavior for other elements
    }
});


})();
