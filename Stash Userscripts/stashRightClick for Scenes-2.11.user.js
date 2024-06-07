// ==UserScript==
// @name         stashRightClick for Scenes
// @namespace    http://localhost:9999/
// @version      2.11
// @description  Adds a custom right-click menu to .scene-card elements on localhost:9999 with options to add tags, performers, or galleries using GraphQL mutations. Updated with debounced searchable dropdowns and improved popup positioning, and appending tags/performers/galleries instead of replacing them.
// @author       https://github.com/Serechops/Serechops-Stash
// @match        http://localhost:9999/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js
// @require      https://unpkg.com/tabulator-tables@5.0.8/dist/js/tabulator.min.js
// ==/UserScript==

(async function() {
    'use strict';

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
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
        }
    `;

    // Inject custom CSS into the document
    const styleElement = document.createElement('style');
    styleElement.innerHTML = customCSS;
    document.head.appendChild(styleElement);

    // Server and API key configuration
    const config = {
        serverUrl: 'http://localhost:9999/graphql',
        apiKey: '' // Add your API key here
    };

    // Store the currently opened right-click menu to close it if another right-click occurs
    let currentMenu = null;
    let currentPopup = null;

    // Function to create the custom menu
    function createCustomMenu(sceneId) {
        const menu = document.createElement('div');
        menu.id = 'custom-menu';
        menu.style.position = 'absolute';
        menu.style.backgroundColor = '#000000';
        menu.style.border = '1px solid #ccc';
        menu.style.zIndex = '10000';
        menu.style.padding = '10px';
        menu.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';

        const viewLink = document.createElement('a');
        viewLink.href = '#';
        viewLink.textContent = 'View Scene';
        viewLink.style.display = 'block';
        viewLink.style.marginBottom = '5px';
        viewLink.addEventListener('click', function(e) {
            e.preventDefault();
            fetchSceneStreams(sceneId);
        });
        menu.appendChild(viewLink);

        const addTagsLink = document.createElement('a');
        addTagsLink.href = '#';
        addTagsLink.textContent = 'Add Tags...';
        addTagsLink.style.display = 'block';
        addTagsLink.style.marginBottom = '5px';
        addTagsLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Tags', sceneId, fetchTags, event);
        });
        menu.appendChild(addTagsLink);

        const addPerformersLink = document.createElement('a');
        addPerformersLink.href = '#';
        addPerformersLink.textContent = 'Add Performers...';
        addPerformersLink.style.display = 'block';
        addPerformersLink.style.marginBottom = '5px';
        addPerformersLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Performers', sceneId, fetchPerformers, event);
        });
        menu.appendChild(addPerformersLink);

        const addGalleriesLink = document.createElement('a');
        addGalleriesLink.href = '#';
        addGalleriesLink.textContent = 'Add Galleries...';
        addGalleriesLink.style.display = 'block';
        addGalleriesLink.style.marginBottom = '5px';
        addGalleriesLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Galleries', sceneId, fetchGalleries, event);
        });
        menu.appendChild(addGalleriesLink);

        const editSceneLink = document.createElement('a');
        editSceneLink.href = '#';
        editSceneLink.textContent = 'Edit Scene';
        editSceneLink.style.display = 'block';
        editSceneLink.style.marginBottom = '5px';
        editSceneLink.addEventListener('click', function(e) {
            e.preventDefault();
            openEditScenePage(sceneId);
        });
        menu.appendChild(editSceneLink);

        document.body.appendChild(menu);
        currentMenu = menu;
        return menu;
    }

    // Function to show the custom menu
    function showCustomMenu(event, sceneId) {
        if (currentMenu) {
            currentMenu.remove();
        }
        if (currentPopup) {
            currentPopup.remove();
        }
        const menu = createCustomMenu(sceneId);
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

    // Function to extract scene ID from URL
    function getSceneIdFromUrl(url) {
        const match = url.match(/scenes\/(\d+)/);
        return match ? match[1] : null;
    }

    // Function to create the Tabulator table in a popup
    function createTabulatorPopup(type, sceneId, fetchFunction, event) {
        console.log(`Creating Tabulator popup for ${type}`);
        const popup = document.createElement('div');
        popup.id = 'popup';
        document.body.appendChild(popup); // Append first to get proper dimensions

        const form = document.createElement('form');
        form.innerHTML = `
            <h2>Add ${type} to Scene</h2>
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
                { title: "Name", field: type === 'Galleries' ? 'title' : 'name' },
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
                await updateSceneWithTags(sceneId, selectedIds);
            } else if (type === 'Performers') {
                await updateSceneWithPerformers(sceneId, selectedIds);
            } else if (type === 'Galleries') {
                await updateSceneWithGalleries(sceneId, selectedIds);
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
        console.log('Fetching tags for query:', query);
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
        console.log('Fetching performers for query:', query);
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

    // Function to fetch galleries matching a query
    async function fetchGalleries(query) {
        console.log('Fetching galleries for query:', query);
        const queryText = `
            query FindGalleries($filter: String!) {
                findGalleries(gallery_filter: { title: { value: $filter, modifier: INCLUDES } }, filter: { per_page: -1 }) {
                    galleries {
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
        return result.data.findGalleries.galleries;
    }

    // Function to update the scene with selected tags using GraphQL
    async function updateSceneWithTags(sceneId, newTagIds) {
        console.log(`Updating scene ${sceneId} with tags:`, newTagIds);
        const existingTagIds = await fetchExistingTagIds(sceneId);
        const allTagIds = Array.from(new Set([...existingTagIds, ...newTagIds]));

        const mutationQuery = `
            mutation SceneUpdate {
                sceneUpdate(input: { id: "${sceneId}", tag_ids: ${JSON.stringify(allTagIds)} }) {
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
                showToast('Failed to update the scene with tags', 'error');
            } else {
                showToast('Scene updated with tags successfully', 'success');
                console.log(result.data.sceneUpdate);
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to update the scene with tags', 'error');
        }
    }

    // Function to update the scene with selected performers using GraphQL
    async function updateSceneWithPerformers(sceneId, newPerformerIds) {
        console.log(`Updating scene ${sceneId} with performers:`, newPerformerIds);
        const existingPerformerIds = await fetchExistingPerformerIds(sceneId);
        const allPerformerIds = Array.from(new Set([...existingPerformerIds, ...newPerformerIds]));

        const mutationQuery = `
            mutation SceneUpdate {
                sceneUpdate(input: { id: "${sceneId}", performer_ids: ${JSON.stringify(allPerformerIds)} }) {
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
                showToast('Failed to update the scene with performers', 'error');
            } else {
                showToast('Scene updated with performers successfully', 'success');
                console.log(result.data.sceneUpdate);
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to update the scene with performers', 'error');
        }
    }

    // Function to update the scene with selected galleries using GraphQL
    async function updateSceneWithGalleries(sceneId, newGalleryIds) {
        console.log(`Updating scene ${sceneId} with galleries:`, newGalleryIds);
        const existingGalleryIds = await fetchExistingGalleryIds(sceneId);
        const allGalleryIds = Array.from(new Set([...existingGalleryIds, ...newGalleryIds]));

        const mutationQuery = `
            mutation SceneUpdate {
                sceneUpdate(input: { id: "${sceneId}", gallery_ids: ${JSON.stringify(allGalleryIds)} }) {
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
                showToast('Failed to update the scene with galleries', 'error');
            } else {
                showToast('Scene updated with galleries successfully', 'success');
                console.log(result.data.sceneUpdate);
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to update the scene with galleries', 'error');
        }
    }

    // Function to fetch existing tag IDs for a scene
    async function fetchExistingTagIds(sceneId) {
        const query = `
            query {
                findScene(id: "${sceneId}") {
                    tags {
                        id
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
            body: JSON.stringify({ query })
        });
        const result = await response.json();
        return result.data.findScene.tags.map(tag => tag.id);
    }

    // Function to fetch existing performer IDs for a scene
    async function fetchExistingPerformerIds(sceneId) {
        const query = `
            query {
                findScene(id: "${sceneId}") {
                    performers {
                        id
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
            body: JSON.stringify({ query })
        });
        const result = await response.json();
        return result.data.findScene.performers.map(performer => performer.id);
    }

    // Function to fetch existing gallery IDs for a scene
    async function fetchExistingGalleryIds(sceneId) {
        const query = `
            query {
                findScene(id: "${sceneId}") {
                    galleries {
                        id
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
            body: JSON.stringify({ query })
        });
        const result = await response.json();
        return result.data.findScene.galleries.map(gallery => gallery.id);
    }

    // Function to show Toast notifications
    function showToast(message, type = "success") {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top", // `top` or `bottom`
            position: "center", // `left`, `center` or `right`
            backgroundColor: type === "success" ? "green" : "red",
        }).showToast();
    }

    // Function to fetch scene streams and navigate to the direct stream
    async function fetchSceneStreams(sceneId) {
        const query = `
            query SceneStreams {
                sceneStreams(id: "${sceneId}") {
                    url
                    mime_type
                    label
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
                body: JSON.stringify({ query })
            });
            const result = await response.json();
            if (result.errors) {
                console.error(result.errors);
                showToast('Failed to fetch scene streams', 'error');
            } else {
                const streams = result.data.sceneStreams;
                const directStream = streams.find(stream => stream.label === 'Direct stream');
                if (directStream) {
                    window.location.href = directStream.url;
                } else {
                    showToast('Direct stream not found', 'error');
                }
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to fetch scene streams', 'error');
        }
    }

    // Function to open the edit scene page and select the 'Edit' tab
    function openEditScenePage(sceneId) {
        const editPageUrl = `http://localhost:9999/scenes/${sceneId}/edit`;
        const newWindow = window.open(editPageUrl, '_blank');
        if (newWindow) {
            newWindow.onload = () => {
                setTimeout(() => {
                    const editTab = newWindow.document.querySelector('[data-rb-event-key="scene-edit-panel"]');
                    if (editTab) {
                        editTab.click();
                    }
                }, 1000); // Wait for the page to load and elements to render
            };
        }
    }

    // Add event listener to .scene-card elements
    document.addEventListener('contextmenu', function(event) {
        const sceneCard = event.target.closest('.scene-card');
        if (sceneCard) {
            const linkElement = sceneCard.querySelector('.scene-card-link');
            if (linkElement) {
                const sceneId = getSceneIdFromUrl(linkElement.href);
                if (sceneId) {
                    showCustomMenu(event, sceneId);
                }
            }
        }
    });

})();
