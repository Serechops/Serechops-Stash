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

    // Inject CSS
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        @import url('https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css');
        @import url('https://unpkg.com/tabulator-tables@5.0.8/dist/css/tabulator_midnight.min.css');

        #scenes-popup {
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
        #scenes-popup h2 {
            margin-top: 0;
            cursor: move;
        }
        #scenes-popup form label {
            display: block;
            margin-top: 10px;
        }
        #scenes-popup form input, #scenes-popup form select {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            box-sizing: border-box;
        }
        #scenes-popup form button {
            margin-top: 15px;
            padding: 10px;
            cursor: pointer;
            background: rgba(0, 0, 0, 0);
            color: #fff;
        }
        #scenes-popup input[type="text"], #scenes-popup select {
            color: black;
        }

        #scenes-custom-menu {
            background-color: #000;
            background: rgba(0, 0, 0, 0.3);
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            position: absolute;
            border: 1px solid #ccc;
            z-index: 10000;
            padding: 10px;
        }

        #scenes-custom-menu a {
            display: block;
            margin-bottom: 5px;
            color: white;
        }

        #playlist {
            position: absolute;
            top: 0;
            right: -300px;
            width: 300px;
            height: 100%;
            background: #333;
            color: white;
            overflow-y: auto;
            transition: right 0.3s;
            z-index: 10002;
        }
        #playlist.show {
            right: 0;
        }
        #playlist ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        #playlist li {
            padding: 10px;
            cursor: pointer;
            border-bottom: 1px solid #555;
        }
        #playlist li:hover {
            background: #444;
        }
    `;
    document.head.appendChild(styleElement);

    const fetchGQL = async (query, variables = {}) =>
        fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ApiKey': config.apiKey
            },
            body: JSON.stringify({ query, variables })
        }).then(res => res.json());

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

    const toastSuccess = (message, debug) => {
        showToast(message, 'success');
        console.log(debug);
    };

    const toastError = (message, debug) => {
        showToast(message, 'error');
        console.error(debug);
    };

    // Store the currently opened right-click menu to close it if another right-click occurs
    let currentMenu = null;
    let currentPopup = null;
    let playlist = [];

    // Function to create the custom menu
    function createCustomMenu(sceneId) {
        const menu = document.createElement('div');
        menu.id = 'scenes-custom-menu';
		
        const addTagsLink = document.createElement('a');
        addTagsLink.href = '#';
        addTagsLink.textContent = 'Add Tags...';
        addTagsLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Tags', sceneId, fetchTags, event);
        });
        menu.appendChild(addTagsLink);

        const addPerformersLink = document.createElement('a');
        addPerformersLink.href = '#';
        addPerformersLink.textContent = 'Add Performers...';
        addPerformersLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Performers', sceneId, fetchPerformers, event);
        });
        menu.appendChild(addPerformersLink);

        const addGalleriesLink = document.createElement('a');
        addGalleriesLink.href = '#';
        addGalleriesLink.textContent = 'Add Galleries...';
        addGalleriesLink.addEventListener('click', function(e) {
            e.preventDefault();
            createTabulatorPopup('Galleries', sceneId, fetchGalleries, event);
        });
        menu.appendChild(addGalleriesLink);

        const editSceneLink = document.createElement('a');
        editSceneLink.href = '#';
        editSceneLink.textContent = 'Edit Scene';
        editSceneLink.addEventListener('click', function(e) {
            e.preventDefault();
            openEditScenePage(sceneId);
        });
        menu.appendChild(editSceneLink);

        // Add Support link at the bottom of the menu with target="_blank"
        const supportLink = document.createElement('a');
        supportLink.href = 'https://www.patreon.com/serechops/membership';
        supportLink.textContent = 'Support';
        supportLink.style.display = 'block';
        supportLink.style.marginTop = '10px';
        supportLink.style.color = '#FFD700';
        supportLink.target = '_blank';
        menu.appendChild(supportLink);

        document.body.appendChild(menu);
        currentMenu = menu;
        return menu;
    }

    // Function to show the custom menu
    function showCustomMenu(event, sceneId) {
        if (currentMenu) currentMenu.remove();
        if (currentPopup) currentPopup.remove();
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
    const getSceneIdFromUrl = (url) => url.match(/scenes\/(\d+)/)?.[1];

    // Function to create the Tabulator table in a popup
	function createTabulatorPopup(type, sceneId, fetchFunction, event) {
		console.log(`Creating Tabulator popup for ${type}`);
		const popup = document.createElement('div');
		popup.id = 'scenes-popup';
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
	
		const tableColumns = [
			{ title: "ID", field: "id" },
			{ title: type === 'Galleries' ? 'Title' : 'Name', field: type === 'Galleries' ? 'title' : 'name' },
		];
	
		if (type === 'Performers') {
			tableColumns.push({ title: "Disambiguation", field: "disambiguation" });
		}
	
		const table = new Tabulator(`#${type.toLowerCase()}-table`, {
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
	
		const filterInput = document.getElementById(`${type.toLowerCase()}-search`);
		filterInput.addEventListener('input', debounce(e => fetchData(e.target.value), 300));
	
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
	
		document.getElementById('cancel').addEventListener('click', () => popup.remove());
	
		// Adjust popup position to be below the right-click menu
		const menuRect = currentMenu.getBoundingClientRect();
		popup.style.left = `${menuRect.left}px`;
		popup.style.top = `${menuRect.bottom}px`;
	}

    // Function to fetch tags matching a query
    async function fetchTags(query) {
        console.log('Fetching tags for query:', query);
        const gqlQuery = `query ($filter: String!) {
            findTags(tag_filter: { name: { value: $filter, modifier: INCLUDES } }, filter: { per_page: -1 }) {
                tags { id name }
            }
        }`;
        return await fetchGQL(gqlQuery, { filter: query })
            .then(res => res.data.findTags.tags);
    }

    // Function to fetch performers matching a query
    async function fetchPerformers(query) {
        console.log('Fetching performers for query:', query);
        const gqlQuery = `query ($filter: String!) {
            findPerformers(performer_filter: { name: { value: $filter, modifier: INCLUDES } }, filter: { per_page: -1 }) {
                performers { id name disambiguation }
            }
        }`;
        return await fetchGQL(gqlQuery, { filter: query })
            .then(res => res.data.findPerformers.performers);
    }

    // Function to fetch galleries matching a query
    async function fetchGalleries(query) {
        console.log('Fetching galleries for query:', query);
        const gqlQuery = `query ($filter: String!) {
            findGalleries(gallery_filter: { title: { value: $filter, modifier: INCLUDES } }, filter: { per_page: -1 }) {
                galleries { id title }
            }
        }`;
        return await fetchGQL(gqlQuery, { filter: query })
            .then(res => res.data.findGalleries.galleries);
    }

    // Function to update the scene with selected tags using GraphQL
    async function updateSceneWithTags(sceneId, newTagIds) {
        console.log(`Updating scene ${sceneId} with tags:`, newTagIds);
        const existingTagIds = await fetchExistingTagIds(sceneId);
        const allTagIds = [...new Set([...existingTagIds, ...newTagIds])];
        const mutationQuery = `mutation ($scene_id: ID!, $tag_ids: [ID!]!) {
            sceneUpdate(input: { id: $scene_id, tag_ids: $tag_ids }) {
                id
            }
        }`;
        const variables = { scene_id: sceneId, tag_ids: allTagIds };
        await fetchGQL(mutationQuery, variables)
            .then(res => {
                if (res.errors) toastError('Failed to update the scene with tags', res.errors);
                else toastSuccess('Scene updated with tags successfully', res.data.sceneUpdate);
            }).catch(err => toastError('Failed to update the scene with tags', err));
    }

    // Function to update the scene with selected performers using GraphQL
    async function updateSceneWithPerformers(sceneId, newPerformerIds) {
        console.log(`Updating scene ${sceneId} with performers:`, newPerformerIds);
        const existingPerformerIds = await fetchExistingPerformerIds(sceneId);
        const allPerformerIds = [...new Set([...existingPerformerIds, ...newPerformerIds])];

        const gqlQuery = `mutation ($scene_id: ID!, $performer_ids: [ID!]!) {
            sceneUpdate(input: { id: $scene_id, performer_ids: $performer_ids }) {
                id
            }
        }`;
        const variables = { scene_id: sceneId, performer_ids: allPerformerIds };
        await fetchGQL(gqlQuery, variables)
            .then(res => {
                if (res.errors) toastError('Failed to update the scene with performers', res.errors);
                else toastSuccess('Scene updated with performers successfully', res.data.sceneUpdate);
            }).catch(err => toastError('Failed to update the scene with performers', err));
    }

    // Function to update the scene with selected galleries using GraphQL
    async function updateSceneWithGalleries(sceneId, newGalleryIds) {
        console.log(`Updating scene ${sceneId} with galleries:`, newGalleryIds);
        const existingGalleryIds = await fetchExistingGalleryIds(sceneId);
        const allGalleryIds = [...new Set([...existingGalleryIds, ...newGalleryIds])];

        const gqlQuery = `mutation ($scene_id: ID!, $gallery_ids: [ID!]!) {
            sceneUpdate(input: { id: $scene_id, gallery_ids: $gallery_ids }) {
                id
            }
        }`;
        const variables = { scene_id: sceneId, gallery_ids: allGalleryIds };
        await fetchGQL(gqlQuery, variables)
            .then(res => {
                if (res.errors) toastError('Failed to update the scene with galleries', res.errors);
                else toastSuccess('Scene updated with galleries successfully', res.data.sceneUpdate);
            }).catch(err => toastError('Failed to update the scene with galleries', err));
    }

    // Function to fetch existing tag IDs for a scene
    async function fetchExistingTagIds(sceneId) {
        const query = `query ($id: ID!) {
            findScene(id: $id) {
                tags { id }
            }
        }`;
        const variables = { id: sceneId };
        return await fetchGQL(query, variables)
            .then(res => res.data.findScene.tags.map(tag => tag.id));
    }

    // Function to fetch existing performer IDs for a scene
    async function fetchExistingPerformerIds(sceneId) {
        const query = `query ($id: ID!) {
            findScene(id: $id) {
                performers { id }
            }
        }`;
        const variables = { id: sceneId };
        return await fetchGQL(query, variables)
            .then(res => res.data.findScene.performers.map(performer => performer.id));
    }

    // Function to fetch existing gallery IDs for a scene
    async function fetchExistingGalleryIds(sceneId) {
        const query = `query ($id: ID!) {
            findScene(id: $id) {
                galleries { id }
            }
        }`;
        const variables = { id: sceneId };
        return await fetchGQL(query, variables)
            .then(res => res.data.findScene.galleries.map(gallery => gallery.id));
    }

    // Function to open the edit scene page and select the 'Edit' tab
    function openEditScenePage(sceneId) {
        const editPageUrl = `${userConfig.scheme}://${userConfig.host}:${userConfig.port}/scenes/${sceneId}/edit`;
        const newWindow = window.open(editPageUrl, '_blank');
        if (newWindow) {
            newWindow.onload = () => {
                setTimeout(() => {
                    const editTab = newWindow.document.querySelector('[data-rb-event-key="scene-edit-panel"]');
                    if (editTab) editTab.click();
                }, 1000);
            };
        }
    }

    // Add event listener to .scene-card elements
    document.addEventListener('contextmenu', async function(event) {
        const sceneCard = event.target.closest('.scene-card .scene-card-link');
        if (sceneCard) {
            event.preventDefault();
            const sceneId = getSceneIdFromUrl(sceneCard.href);
            if (sceneId) {
                showCustomMenu(event, sceneId);
            }
        }
    });
})();
