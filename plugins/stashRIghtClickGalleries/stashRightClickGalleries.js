// User Configuration IIFE
(function() {
    /******************************************
     * USER CONFIGURATION
     ******************************************/
    window.userConfig = {
        scheme: 'http', // or 'https'
        host: 'localhost', // your server IP or hostname
        port: 9999, // your server port
        apiKey: '' // your API key
    };
})();

// Main script IIFE
(async function() {
    'use strict';

    // Build API URL
    const apiUrl = `${window.userConfig.scheme}://${window.userConfig.host}:${window.userConfig.port}/graphql`;

    // Server and API key configuration
    const config = {
        serverUrl: apiUrl,
        apiKey: window.userConfig.apiKey
    };

    // Load Toastify and Tabulator dynamically
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    await loadScript('https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js');
    await loadScript('https://unpkg.com/tabulator-tables@5.0.8/dist/js/tabulator.min.js');

    // Load Toastify CSS dynamically
    const toastifyCSS = document.createElement('link');
    toastifyCSS.rel = 'stylesheet';
    toastifyCSS.href = 'https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css';
    document.head.appendChild(toastifyCSS);

    // Load Tabulator CSS dynamically
    const tabulatorCSS = document.createElement('link');
    tabulatorCSS.rel = 'stylesheet';
    tabulatorCSS.href = 'https://unpkg.com/tabulator-tables@5.0.8/dist/css/tabulator_midnight.min.css';
    document.head.appendChild(tabulatorCSS);

    // Custom CSS for the popup
    const customCSS = `
        #gallery-popup {
            position: absolute;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            border: 1px solid #ccc;
            z-index: 10001;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            width: 500px;
            max-height: 80%;
            overflow-y: auto;
        }
        #gallery-popup h2 {
            margin-top: 0;
            cursor: move; /* Make the header cursor indicate that it's draggable */
        }
        #gallery-popup form label {
            display: block;
            margin-top: 10px;
        }
        #gallery-popup form input, #gallery-popup form select {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            box-sizing: border-box;
        }
        #gallery-popup form button {
            margin-top: 15px;
            padding: 10px;
            cursor: pointer;
            background: rgba(0, 0, 0, 0.5);
            color: #fff;
        }
        #gallery-popup input[type="text"], #gallery-popup select {
            color: black;
        }

        #gallery-custom-menu {
            background-color: #000;
            background: rgba(0, 0, 0, 0.6) !important;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px) !important;
            position: absolute;
            border: 1px solid #ccc;
            z-index: 10000;
            padding: 10px;
        }

        #gallery-custom-menu a {
            display: block;
            margin-bottom: 5px;
            color: white;
        }
    `;

    // Inject custom CSS into the document
    const style = document.createElement('style');
    style.textContent = customCSS;
    document.head.appendChild(style);

    // Fetch GraphQL data
    const fetchGQL = async (query, variables = {}) =>
        fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ApiKey': config.apiKey
            },
            body: JSON.stringify({ query, variables })
        }).then(res => res.json());

    // Store the currently opened right-click menu to close it if another right-click occurs
    let currentMenu = null;
    let currentPopup = null;

    // Function to create the custom menu
    function createCustomMenu(galleryId) {
        const menu = document.createElement('div');
        menu.id = 'gallery-custom-menu';

        const viewLink = document.createElement('a');
        viewLink.href = `${window.userConfig.scheme}://${window.userConfig.host}:${window.userConfig.port}/galleries/${galleryId}`;
        viewLink.textContent = 'View Gallery';
        menu.appendChild(viewLink);

        const addTagsLink = document.createElement('a');
        addTagsLink.href = '#';
        addTagsLink.textContent = 'Add Tags...';
        addTagsLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Tags', galleryId, fetchTags, e);
        });
        menu.appendChild(addTagsLink);

        const addPerformersLink = document.createElement('a');
        addPerformersLink.href = '#';
        addPerformersLink.textContent = 'Add Performers...';
        addPerformersLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Performers', galleryId, fetchPerformers, e);
        });
        menu.appendChild(addPerformersLink);

        const addScenesLink = document.createElement('a');
        addScenesLink.href = '#';
        addScenesLink.textContent = 'Add Scenes...';
        addScenesLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Scenes', galleryId, fetchScenes, e);
        });
        menu.appendChild(addScenesLink);

        // Add Support link at the bottom of the menu with target="_blank"
        const supportLink = document.createElement('a');
        supportLink.href = 'https://www.patreon.com/serechops/membership';
        supportLink.textContent = 'Support';
        supportLink.style.display = 'block';
        supportLink.style.marginTop = '10px'; // Adds some space above the support link
        supportLink.style.color = '#FFD700'; // Optional: You can style the link differently if desired
        supportLink.target = '_blank'; // Opens the link in a new tab
        menu.appendChild(supportLink);

        document.body.appendChild(menu);
        currentMenu = menu;
        return menu;
    }

    // Function to show the custom menu
    function showCustomMenu(event, galleryId) {
        if (currentMenu) {
            currentMenu.remove();
        }
        if (currentPopup) {
            currentPopup.remove();
        }
        const menu = createCustomMenu(galleryId);
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

    // Function to extract gallery ID from URL
    function getGalleryIdFromUrl(url) {
        const match = url.match(/galleries\/(\d+)/);
        return match ? match[1] : null;
    }

    // Function to create the Tabulator table in a popup
    function createTabulatorPopup(type, galleryId, fetchFunction, event) {
        console.log(`Creating Tabulator popup for ${type}`);
        const popup = document.createElement('div');
        popup.id = 'gallery-popup';
        document.body.appendChild(popup);

        const form = document.createElement('form');
        form.innerHTML = `
            <h2>Add ${type} to Gallery</h2>
            <input type="text" id="gallery-${type.toLowerCase()}-search" placeholder="Search ${type}">
            <div id="gallery-${type.toLowerCase()}-table"></div>
            <button type="button" id="gallery-add-${type.toLowerCase()}">Add ${type}</button>
            <button type="button" id="gallery-cancel">Cancel</button>
        `;
        popup.appendChild(form);
        currentPopup = popup;

        // Adjust popup position directly below the right-click menu
        const menuRect = currentMenu.getBoundingClientRect();
        popup.style.position = 'absolute';
        popup.style.top = `${menuRect.bottom}px`;
        popup.style.left = `${menuRect.left}px`;

        // Ensure the popup stays within viewport boundaries
        const rect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (rect.right > viewportWidth) {
            popup.style.left = `${viewportWidth - rect.width}px`;
        }

        if (rect.bottom > viewportHeight) {
            popup.style.top = `${viewportHeight - rect.height}px`;
        }

        // Add draggable functionality
        let isDragging = false;
        let dragOffsetX, dragOffsetY;

        const header = form.querySelector('h2');
        header.onmousedown = function(e) {
            isDragging = true;
            dragOffsetX = e.clientX - popup.offsetLeft;
            dragOffsetY = e.clientY - popup.offsetTop;
            document.onmousemove = function(e) {
                if (isDragging) {
                    popup.style.left = `${e.clientX - dragOffsetX}px`;
                    popup.style.top = `${e.clientY - dragOffsetY}px`;
                }
            };
            document.onmouseup = function() {
                isDragging = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };

        const tableColumns = [
            { title: "ID", field: "id" },
            { title: "Name", field: type === 'Scenes' ? 'title' : 'name' },
        ];

        if (type === 'Performers') {
            tableColumns.push({ title: "Disambiguation", field: "disambiguation" });
        }

        const table = new Tabulator(`#gallery-${type.toLowerCase()}-table`, {
            layout: "fitColumns",
            height: "300px",
            placeholder: "No Data Available",
            selectable: true,
            columns: tableColumns,
        });

        async function fetchData(query) {
            const data = await fetchFunction(query);
            table.setData(data);
        }

        function debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        const filterInput = document.getElementById(`gallery-${type.toLowerCase()}-search`);
        filterInput.addEventListener('input', debounce((e) => {
            const query = e.target.value;
            fetchData(query);
        }, 300));

        document.getElementById(`gallery-add-${type.toLowerCase()}`).addEventListener('click', async function() {
            const selectedRows = table.getSelectedData();
            const selectedIds = selectedRows.map(row => row.id);
            if (type === 'Tags') {
                await updateGalleryWithTags(galleryId, selectedIds);
            } else if (type === 'Performers') {
                await updateGalleryWithPerformers(galleryId, selectedIds);
            } else if (type === 'Scenes') {
                await updateGalleryWithScenes(galleryId, selectedIds);
            }
            popup.remove();
        });

        document.getElementById('gallery-cancel').addEventListener('click', function() {
            popup.remove();
        });
    }

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
        const response = await fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `ApiKey ${config.apiKey}`
            },
            body: JSON.stringify({ query: queryText, variables: { filter: query } })
        });
        const result = await response.json();
        return result.data.findTags.tags;
    }

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
        const response = await fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `ApiKey ${config.apiKey}`
            },
            body: JSON.stringify({ query: queryText, variables: { filter: query } })
        });
        const result = await response.json();
        return result.data.findPerformers.performers;
    }

    async function fetchScenes(query) {
        const queryText = `
            query FindScenes($filter: String!) {
                findScenes(scene_filter: { title: { value: $filter, modifier: INCLUDES } }, filter: { per_page: -1 }) {
                    scenes {
                        id
                        title
                    }
                }
            }
        `;
        const response = await fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `ApiKey ${config.apiKey}`
            },
            body: JSON.stringify({ query: queryText, variables: { filter: query } })
        });
        const result = await response.json();
        return result.data.findScenes.scenes;
    }

    async function updateGalleryWithTags(galleryId, newTagIds) {
        const existingTagsQuery = `
            query FindGallery {
                findGallery(id: ${galleryId}) {
                    tags {
                        id
                    }
                }
            }
        `;

        const existingTagsResponse = await fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `ApiKey ${config.apiKey}`
            },
            body: JSON.stringify({ query: existingTagsQuery })
        });
        const existingTagsResult = await existingTagsResponse.json();
        const existingTagIds = existingTagsResult.data.findGallery.tags.map(tag => tag.id);

        const combinedTagIds = Array.from(new Set([...existingTagIds, ...newTagIds]));

        const mutationQuery = `
            mutation GalleryUpdate {
                galleryUpdate(input: { id: "${galleryId}", tag_ids: ${JSON.stringify(combinedTagIds)} }) {
                    id
                }
            }
        `;

        try {
            const response = await fetch(config.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `ApiKey ${config.apiKey}`
                },
                body: JSON.stringify({ query: mutationQuery })
            });

            const result = await response.json();
            if (result.errors) {
                console.error(result.errors);
                showToast('Failed to update the gallery with tags', 'error');
            } else {
                showToast('Gallery updated with tags successfully', 'success');
                console.log(result.data.galleryUpdate);
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to update the gallery with tags', 'error');
        }
    }

    async function updateGalleryWithPerformers(galleryId, newPerformerIds) {
        const existingPerformersQuery = `
            query FindGallery {
                findGallery(id: ${galleryId}) {
                    performers {
                        id
                    }
                }
            }
        `;

        const existingPerformersResponse = await fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `ApiKey ${config.apiKey}`
            },
            body: JSON.stringify({ query: existingPerformersQuery })
        });
        const existingPerformersResult = await existingPerformersResponse.json();
        const existingPerformerIds = existingPerformersResult.data.findGallery.performers.map(performer => performer.id);

        const combinedPerformerIds = Array.from(new Set([...existingPerformerIds, ...newPerformerIds]));

        const mutationQuery = `
            mutation GalleryUpdate {
                galleryUpdate(input: { id: "${galleryId}", performer_ids: ${JSON.stringify(combinedPerformerIds)} }) {
                    id
                }
            }
        `;

        try {
            const response = await fetch(config.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `ApiKey ${config.apiKey}`
                },
                body: JSON.stringify({ query: mutationQuery })
            });

            const result = await response.json();
            if (result.errors) {
                console.error(result.errors);
                showToast('Failed to update the gallery with performers', 'error');
            } else {
                showToast('Gallery updated with performers successfully', 'success');
                console.log(result.data.galleryUpdate);
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to update the gallery with performers', 'error');
        }
    }

    async function updateGalleryWithScenes(galleryId, newSceneIds) {
        const existingScenesQuery = `
            query FindGallery {
                findGallery(id: ${galleryId}) {
                    scenes {
                        id
                    }
                }
            }
        `;

        const existingScenesResponse = await fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `ApiKey ${config.apiKey}`
            },
            body: JSON.stringify({ query: existingScenesQuery })
        });
        const existingScenesResult = await existingScenesResponse.json();
        const existingSceneIds = existingScenesResult.data.findGallery.scenes.map(scene => scene.id);

        const combinedSceneIds = Array.from(new Set([...existingSceneIds, ...newSceneIds]));

        const mutationQuery = `
            mutation GalleryUpdate {
                galleryUpdate(input: { id: "${galleryId}", scene_ids: ${JSON.stringify(combinedSceneIds)} }) {
                    id
                }
            }
        `;

        try {
            const response = await fetch(config.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `ApiKey ${config.apiKey}`
                },
                body: JSON.stringify({ query: mutationQuery })
            });

            const result = await response.json();
            if (result.errors) {
                console.error(result.errors);
                showToast('Failed to update the gallery with scenes', 'error');
            } else {
                showToast('Gallery updated with scenes successfully', 'success');
                console.log(result.data.galleryUpdate);
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to update the gallery with scenes', 'error');
        }
    }

    // Example of using Toastify
    function showToast(message, type = "success") {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top", // `top` or `bottom`
            position: "center", // `left`, `center` or `right`
            backgroundColor: type === "success" ? "green" : "red",
        }).showToast();
    }

    // Add event listener to .gallery-card elements
    document.addEventListener('contextmenu', function(event) {
        const galleryCard = event.target.closest('.gallery-card');
        if (galleryCard) {
            const linkElement = galleryCard.querySelector('.gallery-card-header');
            if (linkElement) {
                const galleryId = getGalleryIdFromUrl(linkElement.href);
                if (galleryId) {
                    showCustomMenu(event, galleryId);
                }
            }
        }
    });

})();
