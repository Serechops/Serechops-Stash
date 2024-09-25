// Main script IIFE
(async function() {
    'use strict';

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

    // Fetch GraphQL data using relative URL
    const fetchGQL = async (query, variables = {}) =>
        fetch('/graphql', { // Use relative URL for cookie-based auth
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        viewLink.href = `/galleries/${galleryId}`;
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
        supportLink.style.marginTop = '10px';
        supportLink.style.color = '#FFD700';
        supportLink.target = '_blank';
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
        const result = await fetchGQL(queryText, { filter: query });
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
        const result = await fetchGQL(queryText, { filter: query });
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
        const result = await fetchGQL(queryText, { filter: query });
        return result.data.findScenes.scenes;
    }

    async function updateGalleryWithTags(galleryId, newTagIds) {
        const existingTagsQuery = `
            query FindGallery($id: ID!) {
                findGallery(id: $id) {
                    tags {
                        id
                    }
                }
            }
        `;
        const existingTagsResult = await fetchGQL(existingTagsQuery, { id: galleryId });
        const existingTagIds = existingTagsResult.data.findGallery.tags.map(tag => tag.id);

        const combinedTagIds = Array.from(new Set([...existingTagIds, ...newTagIds]));

        const mutationQuery = `
            mutation GalleryUpdate($input: GalleryUpdateInput!) {
                galleryUpdate(input: $input) {
                    id
                }
            }
        `;

        const input = { id: galleryId, tag_ids: combinedTagIds };

        try {
            const result = await fetchGQL(mutationQuery, { input });
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
            query FindGallery($id: ID!) {
                findGallery(id: $id) {
                    performers {
                        id
                    }
                }
            }
        `;
        const existingPerformersResult = await fetchGQL(existingPerformersQuery, { id: galleryId });
        const existingPerformerIds = existingPerformersResult.data.findGallery.performers.map(performer => performer.id);

        const combinedPerformerIds = Array.from(new Set([...existingPerformerIds, ...newPerformerIds]));

        const mutationQuery = `
            mutation GalleryUpdate($input: GalleryUpdateInput!) {
                galleryUpdate(input: $input) {
                    id
                }
            }
        `;

        const input = { id: galleryId, performer_ids: combinedPerformerIds };

        try {
            const result = await fetchGQL(mutationQuery, { input });
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
            query FindGallery($id: ID!) {
                findGallery(id: $id) {
                    scenes {
                        id
                    }
                }
            }
        `;
        const existingScenesResult = await fetchGQL(existingScenesQuery, { id: galleryId });
        const existingSceneIds = existingScenesResult.data.findGallery.scenes.map(scene => scene.id);

        const combinedSceneIds = Array.from(new Set([...existingSceneIds, ...newSceneIds]));

        const mutationQuery = `
            mutation GalleryUpdate($input: GalleryUpdateInput!) {
                galleryUpdate(input: $input) {
                    id
                }
            }
        `;

        const input = { id: galleryId, scene_ids: combinedSceneIds };

        try {
            const result = await fetchGQL(mutationQuery, { input });
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

    // Toastify
    function showToast(message, type = "success") {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "center",
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
