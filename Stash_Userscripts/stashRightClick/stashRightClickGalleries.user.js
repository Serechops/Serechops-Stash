// ==UserScript==
// @name         stashRightClick for Galleries
// @namespace    https://github.com/Serechops/Serechops-Stash
// @version      1.2
// @description  Adds a custom right-click menu to .gallery-card elements with options to add tags, performers, or scenes using GraphQL mutations.
// @author       Serechops
// @match        http://localhost:9999/*
// @grant        GM_addStyle
// @require      https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js
// @require      https://unpkg.com/tabulator-tables@5.0.8/dist/js/tabulator.min.js
// @downloadURL  https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/stashRightClickGalleries.user.js
// @updateURL    https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/stashRightClickGalleries.user.js
// @run-at       document-end
// ==/UserScript==

(async function() {
    'use strict';

    /******************************************
     * USER CONFIGURATION
     ******************************************/
    const userConfig = {
        scheme: 'http', // or 'https'
        host: 'localhost', // your server IP or hostname
        port: 9999, // your server port
        apiKey: '' // your API key
    };

    // Build API URL
    const apiUrl = `${userConfig.scheme}://${userConfig.host}:${userConfig.port}/graphql`;

    // Server and API key configuration
    const config = {
        serverUrl: apiUrl,
        apiKey: userConfig.apiKey
    };

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
            gravity: "top", // `top` or `bottom`
            position: "center", // `left`, `center` or `right`
            backgroundColor: type === "success" ? "green" : "red",
        }).showToast();
    }

    // Custom CSS for the popup
    const customCSS = `
        #popup {
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
        #popup h2 {
            margin-top: 0;
            cursor: move; /* Make the header cursor indicate that it's draggable */
        }
        #popup form label {
            display: block;
            margin-top: 10px;
        }
        #popup form input, #popup form select {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            box-sizing: border-box;
        }
        #popup form button {
            margin-top: 15px;
            padding: 10px;
            cursor: pointer;
            background: rgba(0, 0, 0, 0.5);
            color: #fff;
        }
        #popup input[type="text"], #popup select {
            color: black;
        }

        #custom-menu {
            background-color: #000;
            background: rgba(0, 0, 0, 0.6) !important;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px) !important;
            position: absolute;
            border: 1px solid #ccc;
            z-index: 10000;
            padding: 10px;
        }

        #custom-menu a {
            display: block;
            margin-bottom: 5px;
        }
    `;

    // Inject custom CSS into the document using GM_addStyle
    GM_addStyle(customCSS);

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
        menu.id = 'custom-menu';
        menu.style.position = 'absolute';
        menu.style.backgroundColor = '#000000';
        menu.style.border = '1px solid #ccc';
        menu.style.zIndex = '10000';
        menu.style.padding = '10px';
        menu.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';

        const viewLink = document.createElement('a');
        viewLink.href = `${userConfig.scheme}://${userConfig.host}:${userConfig.port}/galleries/${galleryId}`;
        viewLink.textContent = 'View Gallery';
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
            createTabulatorPopup('Tags', galleryId, fetchTags, event);
        });
        menu.appendChild(addTagsLink);

        const addPerformersLink = document.createElement('a');
        addPerformersLink.href = '#';
        addPerformersLink.textContent = 'Add Performers...';
        addPerformersLink.style.display = 'block';
        addPerformersLink.style.marginBottom = '5px';
        addPerformersLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Performers', galleryId, fetchPerformers, event);
        });
        menu.appendChild(addPerformersLink);

        const addScenesLink = document.createElement('a');
        addScenesLink.href = '#';
        addScenesLink.textContent = 'Add Scenes...';
        addScenesLink.style.display = 'block';
        addScenesLink.style.marginBottom = '5px';
        addScenesLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Scenes', galleryId, fetchScenes, event);
        });
        menu.appendChild(addScenesLink);

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
        popup.id = 'popup';
        document.body.appendChild(popup); // Append first to get proper dimensions

        const form = document.createElement('form');
        form.innerHTML = `
            <h2>Add ${type} to Gallery</h2>
            <input type="text" id="${type.toLowerCase()}-search" placeholder="Search ${type}">
            <div id="${type.toLowerCase()}-table"></div>
            <button type="button" id="add-${type.toLowerCase()}">Add ${type}</button>
            <button type="button" id="cancel">Cancel</button>
        `;
        popup.appendChild(form);
        currentPopup = popup;

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

        const table = new Tabulator(`#${type.toLowerCase()}-table`, {
            layout: "fitColumns",
            height: "300px",
            placeholder: "No Data Available",
            selectable: true,
            columns: [
                { title: "Name", field: type === 'Scenes' ? 'title' : 'name' },
            ],
        });

        async function fetchData(query) {
            const data = await fetchFunction(query);
            table.setData(data);
        }

        // Debounce function to limit the rate at which a function can fire
        function debounce(func, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        // Add input field for filtering
        const filterInput = document.getElementById(`${type.toLowerCase()}-search`);
        filterInput.addEventListener('input', debounce((e) => {
            const query = e.target.value;
            fetchData(query);
        }, 300));

        document.getElementById(`add-${type.toLowerCase()}`).addEventListener('click', async function() {
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

        document.getElementById('cancel').addEventListener('click', function() {
            popup.remove();
        });

        // Adjust popup position after content is set
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

    // Function to fetch performers matching a query
    async function fetchPerformers(query) {
        const queryText = `
            query FindPerformers($filter: String!) {
                findPerformers(performer_filter: { name: { value: $filter, modifier: INCLUDES } }, filter: { per_page: -1 }) {
                    performers {
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
        return result.data.findPerformers.performers;
    }

    // Function to fetch scenes matching a query
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

    // Function to fetch all tags and show the form
    function fetchAllTags(galleryId, menu) {
        const query = `
            query AllTags {
                allTags {
                    id
                    name
                }
            }
        `;
        fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `ApiKey ${config.apiKey}`
            },
            body: JSON.stringify({ query })
        })
        .then(response => response.json())
        .then(result => {
            if (result.errors) {
                console.error(result.errors);
                showToast('Failed to fetch tags', 'error');
            } else {
                const tags = result.data.allTags.filter(tag => tag.name).sort((a, b) => a.name.localeCompare(b.name));
                createPopupFormForTags(galleryId, tags, menu);
            }
        })
        .catch(error => {
            console.error(error);
            showToast('Failed to fetch tags', 'error');
        });
    }

    // Function to fetch all performers and show the form
    function fetchAllPerformers(galleryId, menu) {
        const query = `
            query AllPerformers {
                allPerformers {
                    id
                    name
                }
            }
        `;
        fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `ApiKey ${config.apiKey}`
            },
            body: JSON.stringify({ query })
        })
        .then(response => response.json())
        .then(result => {
            if (result.errors) {
                console.error(result.errors);
                showToast('Failed to fetch performers', 'error');
            } else {
                const performers = result.data.allPerformers.filter(performer => performer.name).sort((a, b) => a.name.localeCompare(b.name));
                createPopupFormForPerformers(galleryId, performers, menu);
            }
        })
        .catch(error => {
            console.error(error);
            showToast('Failed to fetch performers', 'error');
        });
    }

    // Function to fetch all scenes and show the form
    function fetchAllScenes(galleryId, menu) {
        const query = `
            query AllScenes {
                allScenes {
                    id
                    title
                }
            }
        `;
        fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `ApiKey ${config.apiKey}`
            },
            body: JSON.stringify({ query })
        })
        .then(response => response.json())
        .then(result => {
            if (result.errors) {
                console.error(result.errors);
                showToast('Failed to fetch scenes', 'error');
            } else {
                const scenes = result.data.allScenes.filter(scene => scene.title).sort((a, b) => a.title.localeCompare(b.title));
                createPopupFormForScenes(galleryId, scenes, menu);
            }
        })
        .catch(error => {
            console.error(error);
            showToast('Failed to fetch scenes', 'error');
        });
    }

    // Function to update the gallery with selected tags using GraphQL
    async function updateGalleryWithTags(galleryId, newTagIds) {
        // First fetch existing tags
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

    // Function to update the gallery with selected performers using GraphQL
    async function updateGalleryWithPerformers(galleryId, newPerformerIds) {
        // First fetch existing performers
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

    // Function to update the gallery with selected scenes using GraphQL
    async function updateGalleryWithScenes(galleryId, newSceneIds) {
        // First fetch existing scenes
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
