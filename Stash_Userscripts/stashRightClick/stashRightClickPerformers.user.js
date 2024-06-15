// ==UserScript==
// @name         stashRightClick for Performers
// @namespace    https://github.com/Serechops/Serechops-Stash
// @version      1.8
// @description  Adds a custom right-click menu to .performer-card elements with options like "Missing Scenes", "Change Image", and "Auto-Tag" using GraphQL queries.
// @match        http://localhost:9999/*
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @connect      stashdb.org
// @require      https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js
// @require      https://cdn.jsdelivr.net/npm/chart.js
// @downloadURL  https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/stashRightClickPerformers.user.js
// @updateURL    https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/stashRightClickPerformers.user.js
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
        apiKey: '', // your API key for local Stash server
        stashDBApiKey: '' // your API key for StashDB
    };

    // Build API URL
    const apiUrl = `${userConfig.scheme}://${userConfig.host}:${userConfig.port}/graphql`;

    // Server and API key configuration
    const config = {
        serverUrl: apiUrl,
        apiKey: userConfig.apiKey,
        stashDBApiKey: userConfig.stashDBApiKey
    };

    // Inject CSS for the custom menu, modals, and loading spinner
    GM_addStyle(`
        @import url('https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css');
        @import url('https://unpkg.com/tabulator-tables@5.0.8/dist/css/tabulator_midnight.min.css');

        #custom-popup {
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
        #custom-popup h2 {
            margin-top: 0;
            cursor: move; /* Make the header cursor indicate that it's draggable */
        }
        #custom-popup form label {
            display: block;
            margin-top: 10px;
        }
        #custom-popup form input, #custom-popup form select {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            box-sizing: border-box;
        }
        #custom-popup form button {
            margin-top: 15px;
            padding: 10px;
            cursor: pointer;
            background: rgba(0, 0, 0, 0.5);
            color: #fff;
        }
        #custom-popup input[type="text"], #custom-popup select {
            color: black;
        }

        #custom-menu {
            background-color: #000;
            background: rgba(0, 0, 0, 0.3);
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            position: absolute;
            border: 1px solid #ccc;
            z-index: 10000;
            padding: 10px;
        }

        #custom-menu a {
            display: block;
            margin-bottom: 5px;
        }

        .custom-modal {
            display: none;
            position: fixed;
            z-index: 10001;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0, 0, 0, 0.8);
        }

        .custom-modal-content {
            background: rgba(0, 0, 0, 0.5);
            margin: 5% auto;
            padding: 20px;
            border: 1px solid #888;
            width: 80%;
            max-width: 1000px;
            max-height: 80vh;
            overflow-y: auto;
        }

        .custom-close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
        }

        .custom-close:hover,
        .custom-close:focus {
            color: black;
            text-decoration: none;
            cursor: pointer;
        }

        #custom-imageGallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 10px;
        }

        .custom-image-option-container {
            position: relative;
            display: inline-block;
        }

        .image-dimensions {
            position: absolute;
            bottom: 5px;
            left: 5px;
            background-color: rgba(0, 0, 0, 0.5);
            color: white;
            padding: 2px 5px;
            font-size: 10px;
            border-radius: 3px;
        }

        .custom-image-option {
            width: 100px;
            height: 150px;
            object-fit: cover;
            cursor: pointer;
            border: 2px solid transparent;
        }

        .custom-image-option.selected {
            border-color: #007bff;
        }

        #custom-applyImage {
            display: block;
            margin: 10px auto;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            border: none;
            cursor: pointer;
        }

        #custom-pagination-controls {
            text-align: center;
            margin-top: 10px;
        }

        .custom-page-link {
            margin: 0 5px;
            cursor: pointer;
            color: #007bff;
            background: rgba(0, 0, 0, 0.5);
            text-decoration: underline;
        }

        .custom-scene-option {
            cursor: pointer;
            border-bottom: 1px solid #ccc;
            padding: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .custom-scene-option h3 {
            margin: 0;
            font-size: 12px;
            text-align: center;
        }

        .custom-scene-option img {
            max-width: 100%;
            height: auto;
        }

        .custom-scene-option p, .custom-scene-option a {
            margin: 5px 0;
            font-size: 12px;
            text-align: center;
        }

        #custom-sceneGallery {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }

        /* Loading spinner styles */
        #loading-spinner {
            display: none;
            position: fixed;
            z-index: 10002;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 200px;
            height: 300px;
            background-color: rgba(0, 0, 0, 0.8);
            border-radius: 25%;
            overflow: hidden;
        }

        #loading-spinner img {
        position: absolute;
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0;
        animation: fadeIn 1s forwards;
         }

       @keyframes fadeIn {
       0% { opacity: 0; }
       100% { opacity: 1; }
         }


        #loading-spinner .loading-header {
        position: absolute;
        bottom: 10px;
        width: 100%;
        text-align: center;
        color: white;
        font-size: 18px;
        font-weight: bold;
        }


        @keyframes bookSlide {
            0% { transform: translateX(0); }
            100% { transform: translateX(-100%); }
        }

        #dim-overlay {
            display: none;
            position: fixed;
            z-index: 10001;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
        }

        .loading-header {
        outline: 1px solid black;
        background: rgba(0, 0, 0, 0.5);
       }
    `);

    const spinnerHTML = `<div id="loading-spinner"><img src=""></div>`;
    const dimOverlayHTML = `<div id="dim-overlay"></div>`;
    document.body.insertAdjacentHTML('beforeend', spinnerHTML);
    document.body.insertAdjacentHTML('beforeend', dimOverlayHTML);

    let slideshowInterval;
    function startSlideshow(images) {
        const spinner = document.getElementById('loading-spinner');
        let currentIndex = 0;

        function showNextImage() {
            if (currentIndex >= images.length) {
                currentIndex = 0;
            }
            const imgHTML = `<img src="${images[currentIndex].url}" alt="Image">`;
            spinner.insertAdjacentHTML('afterbegin', imgHTML);
            const imgElement = spinner.querySelector('img');
            imgElement.addEventListener('animationend', () => {
                const allImages = spinner.querySelectorAll('img');
                if (allImages.length > 1) {
                    allImages[1].remove(); // Remove the previous image
                }
            });
            currentIndex++;
        }

        showNextImage();
        setInterval(showNextImage, 2000); // Change image every 3 seconds
    }

    function showLoadingSpinner(images) {
        const spinner = document.getElementById('loading-spinner');
        const dimOverlay = document.getElementById('dim-overlay');
        if (spinner) {
            spinner.innerHTML = '<div class="loading-header">Fetching Scenes...</div>';
            startSlideshow(images);
            spinner.style.display = 'block';
            dimOverlay.style.display = 'block';
        }
    }


    function hideLoadingSpinner() {
        const spinner = document.getElementById('loading-spinner');
        const dimOverlay = document.getElementById('dim-overlay');
        if (spinner) {
            clearInterval(slideshowInterval);
            spinner.style.display = 'none';
            dimOverlay.style.display = 'none';
        }
    }

    // Function to extract performer ID from the URL
    function getPerformerID(url) {
        const urlParts = url.split('/');
        return urlParts[urlParts.length - 1];
    }

    // Function to fetch performer's StashDB ID
    async function fetchPerformerStashDBID(performerID) {
        const query = `
            query FindPerformer($id: ID!) {
                findPerformer(id: $id) {
                    stash_ids {
                        stash_id
                    }
                }
            }
        `;
        try {
            const response = await graphqlRequest(query, { id: performerID }, config.apiKey);
            if (response && response.data && response.data.findPerformer) {
                return response.data.findPerformer.stash_ids.map(id => id.stash_id);
            } else {
                console.error('No stash_ids found for performer:', performerID);
                return null;
            }
        } catch (error) {
            console.error('Error fetching performer StashDB ID:', error);
            return null;
        }
    }

    // Function to fetch performer images
    async function fetchPerformerImages(performerStashID) {
        const query = `
            query FindPerformer($id: ID!) {
                findPerformer(id: $id) {
                    images {
                        url
                        width
                        height
                    }
                }
            }
        `;
        try {
            const response = await gqlQuery('https://stashdb.org/graphql', query, { id: performerStashID }, config.stashDBApiKey);
            if (response && response.data && response.data.findPerformer) {
                return response.data.findPerformer.images;
            } else {
                console.error('No images found for performer:', performerStashID);
                return [];
            }
        } catch (error) {
            console.error('Error fetching performer images:', error);
            return [];
        }
    }

    // Function to fetch performer details
    async function fetchPerformerDetails(performerID) {
        const query = `
            query FindPerformer($id: ID!) {
                findPerformer(id: $id) {
                    id
                    name
                    scenes {
                        title
                        stash_ids {
                            stash_id
                        }
                    }
                }
            }
        `;
        try {
            const response = await graphqlRequest(query, { id: performerID }, config.apiKey);
            if (response && response.data && response.data.findPerformer) {
                return response.data.findPerformer;
            } else {
                console.error('No details found for performer:', performerID);
                return null;
            }
        } catch (error) {
            console.error('Error fetching performer details:', error);
            return null;
        }
    }

    // Function to fetch scenes from StashDB
    async function fetchStashDBScenes(stash_ids, page = 1) {
        const query = `
            query QueryScenes($stash_ids: [ID!]!, $page: Int!) {
                queryScenes(
                    input: {
                        performers: {
                            value: $stash_ids,
                            modifier: INCLUDES
                        },
                        per_page: 25,
                        page: $page
                    }
                ) {
                    scenes {
                        id
                        title
                        release_date
                        urls {
                            url
                        }
                        images {
                            url
                        }
                        studio {
                            name
                            urls {
                                url
                            }
                        }
                    }
                    count
                }
            }
        `;
        try {
            const response = await gqlQuery('https://stashdb.org/graphql', query, { stash_ids, page }, config.stashDBApiKey);
            if (response && response.data && response.data.queryScenes) {
                return response.data.queryScenes;
            } else {
                console.error('No scenes found for performer:', stash_ids);
                return null;
            }
        } catch (error) {
            console.error('Error fetching scenes from StashDB:', error);
            return null;
        }
    }

    // Function to compare local and StashDB scenes
    function compareScenes(localScenes, stashDBScenes) {
        const localSceneTitles = new Set(localScenes.map(scene => scene.title));
        const stashDBSceneTitles = new Set(stashDBScenes.map(scene => scene.title));
        const missingScenes = stashDBScenes.filter(scene => !localSceneTitles.has(scene.title));
        return missingScenes;
    }

    // Function to create the missing scenes modal
    function createMissingScenesModal(missingScenes) {
        const totalScenes = missingScenes.length;
        let currentPage = 1;
        const scenesPerPage = 25;
        const totalPages = Math.ceil(totalScenes / scenesPerPage);

        function renderScenes(page) {
            const start = (page - 1) * scenesPerPage;
            const end = start + scenesPerPage;
            const scenesHTML = missingScenes.slice(start, end).sort((a, b) => new Date(b.release_date) - new Date(a.release_date)).map(scene => `
                <div class="custom-scene-option" data-id="${scene.id}">
                    <h3>${scene.title}</h3>
                    <img src="${scene.images[0]?.url || ''}" alt="${scene.title}">
                    <p>Release Date: ${scene.release_date}</p>
                    <p>Studio: ${scene.studio?.name || 'N/A'}</p>
                    ${scene.studio?.urls?.[0]?.url ? `<a href="${scene.studio.urls[0].url}" target="_blank">Visit the Studio</a>` : ''}
                    <a href="https://stashdb.org/scenes/${scene.id}" target="_blank">Find on StashDB</a>
                </div>
            `).join('');
            document.getElementById('custom-sceneGallery').innerHTML = scenesHTML;

            document.getElementById('custom-pagination-controls-scenes').innerHTML = `
                ${page > 1 ? `<span class="custom-page-link" data-page="${page - 1}">Previous</span>` : ''}
                ${page < totalPages ? `<span class="custom-page-link" data-page="${page + 1}">Next</span>` : ''}
            `;

            document.querySelectorAll('.custom-page-link').forEach(link => {
                link.onclick = function() {
                    renderScenes(parseInt(link.getAttribute('data-page')));
                };
            });
        }

        const modalHTML = `
            <div id="custom-missingScenesModal" class="custom-modal">
                <div class="custom-modal-content">
                    <span class="custom-close">&times;</span>
                    <center><h2>Missing Scenes from StashDB</h2></center>
                    <div id="custom-sceneGallery"></div>
                    <div id="custom-pagination-controls-scenes"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        renderScenes(currentPage);

        const modal = document.getElementById('custom-missingScenesModal');
        const span = document.getElementsByClassName('custom-close')[0];
        span.onclick = function() {
            modal.style.display = 'none';
            modal.remove();
        };
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = 'none';
                modal.remove();
            }
        };
    }

    // Function to create the image selection modal
    function createImageSelectionModal(images, performerID) {
        const totalImages = images.length;
        let currentPage = 1;
        const imagesPerPage = 16;
        const totalPages = Math.ceil(totalImages / imagesPerPage);

        function renderImages(page) {
            const start = (page - 1) * imagesPerPage;
            const end = start + imagesPerPage;
            const imageHTML = images.slice(start, end).map(img => `
                <div class="custom-image-option-container">
                    <img src="${img.url}" class="custom-image-option" data-url="${img.url}">
                    <div class="image-dimensions">(${img.width} x ${img.height})</div>
                </div>
            `).join('');
            document.getElementById('custom-imageGallery').innerHTML = imageHTML;

            document.querySelectorAll('.custom-image-option').forEach(img => {
                img.onclick = function() {
                    document.querySelectorAll('.custom-image-option').forEach(img => img.classList.remove('selected'));
                    img.classList.add('selected');
                };
            });

            document.getElementById('custom-pagination-controls').innerHTML = `
                ${page > 1 ? `<span class="custom-page-link" data-page="${page - 1}">Previous</span>` : ''}
                ${page < totalPages ? `<span class="custom-page-link" data-page="${page + 1}">Next</span>` : ''}
            `;

            document.querySelectorAll('.custom-page-link').forEach(link => {
                link.onclick = function() {
                    renderImages(parseInt(link.getAttribute('data-page')));
                };
            });
        }

        const modalHTML = `
            <div id="custom-imageSelectionModal" class="custom-modal">
                <div class="custom-modal-content">
                    <span class="custom-close">&times;</span>
                    <center><h2>StashDB Performer Images</h2></center>
                    <div id="custom-imageGallery"></div>
                    <div id="custom-pagination-controls"></div>
                    <button id="custom-applyImage">Apply</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        renderImages(currentPage);

        const modal = document.getElementById('custom-imageSelectionModal');
        const span = document.getElementsByClassName('custom-close')[0];
        span.onclick = function() {
            modal.style.display = 'none';
            modal.remove();
        };
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = 'none';
                modal.remove();
            }
        };

        document.getElementById('custom-applyImage').onclick = async function() {
            const selectedImage = document.querySelector('.custom-image-option.selected');
            if (selectedImage) {
                const imageUrl = selectedImage.getAttribute('data-url');
                const success = await updatePerformerImage(performerID, imageUrl);
                if (success) {
                    modal.style.display = 'none';
                    modal.remove();
                    Toastify({
                        text: 'Image updated successfully',
                        backgroundColor: 'green',
                        position: "center",
                        duration: 3000
                    }).showToast();
                } else {
                    Toastify({
                        text: 'Failed to update image',
                        backgroundColor: 'red',
                        position: "center",
                        duration: 3000
                    }).showToast();
                }
            } else {
                Toastify({
                    text: 'Please select an image',
                    backgroundColor: 'orange',
                    position: "center",
                    duration: 3000
                }).showToast();
            }
        };
    }

    // Function to update performer image
    async function updatePerformerImage(performerID, imageUrl) {
        const mutation = `
            mutation PerformerUpdate($id: ID!, $image: String!) {
                performerUpdate(input: { id: $id, image: $image }) {
                    id
                }
            }
        `;
        try {
            const response = await graphqlRequest(mutation, { id: performerID, image: imageUrl }, config.apiKey);
            if (response && response.data && response.data.performerUpdate) {
                return response.data.performerUpdate.id;
            } else {
                console.error('Failed to update performer image:', performerID);
                return null;
            }
        } catch (error) {
            console.error('Error updating performer image:', error);
            return null;
        }
    }

    // Function to auto-tag performer
    async function autoTagPerformer(performerID) {
        const mutation = `
            mutation MetadataAutoTag {
                metadataAutoTag(input: { performers: "${performerID}" })
            }
        `;
        try {
            const response = await graphqlRequest(mutation, {}, config.apiKey);
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
                    text: 'Failed to auto-tag performer',
                    backgroundColor: 'red',
                    position: "center",
                    duration: 3000
                }).showToast();
                return null;
            }
        } catch (error) {
            Toastify({
                text: 'Error auto-tagging performer',
                backgroundColor: 'red',
                position: "center",
                duration: 3000
            }).showToast();
            console.error('Error auto-tagging performer:', error);
            return null;
        }
    }

    // Function to create the custom menu
    function createCustomMenu(performerID) {
        const menu = document.createElement('div');
        menu.id = 'custom-menu';

        const missingScenesLink = document.createElement('a');
        missingScenesLink.href = '#';
        missingScenesLink.textContent = 'Missing Scenes';
        missingScenesLink.addEventListener('click', async function(e) {
            e.preventDefault();
            const stashIDs = await fetchPerformerStashDBID(performerID);
            if (stashIDs) {
                const images = await fetchPerformerImages(stashIDs[0]);
                showLoadingSpinner(images);
                const localDetails = await fetchPerformerDetails(performerID);
                const stashDBScenes = [];
                let page = 1;
                while (true) {
                    const result = await fetchStashDBScenes(stashIDs, page);
                    stashDBScenes.push(...result.scenes);
                    if (stashDBScenes.length >= result.count || result.scenes.length < 25) break;
                    page++;
                }
                if (localDetails && stashDBScenes) {
                    const missingScenes = compareScenes(localDetails.scenes, stashDBScenes);
                    createMissingScenesModal(missingScenes);
                    document.getElementById('custom-missingScenesModal').style.display = 'block';
                } else {
                    console.error('Failed to fetch performer details or StashDB scenes');
                }
                hideLoadingSpinner();
            } else {
                console.error('Failed to fetch performer StashDB ID');
            }
        });
        menu.appendChild(missingScenesLink);

        const changeImageLink = document.createElement('a');
        changeImageLink.href = '#';
        changeImageLink.textContent = 'Change Image...';
        changeImageLink.addEventListener('click', async function(e) {
            e.preventDefault();
            const stashIDs = await fetchPerformerStashDBID(performerID);
            if (stashIDs && stashIDs.length > 0) {
                const images = await fetchPerformerImages(stashIDs[0]);
                if (images && images.length > 0) {
                    createImageSelectionModal(images, performerID);
                    document.getElementById('custom-imageSelectionModal').style.display = 'block';
                } else {
                    console.error('No images found for performer');
                }
            } else {
                console.error('Failed to fetch performer StashDB ID');
            }
        });
        menu.appendChild(changeImageLink);

        const autoTagLink = document.createElement('a');
        autoTagLink.href = '#';
        autoTagLink.textContent = 'Auto-Tag...';
        autoTagLink.addEventListener('click', async function(e) {
            e.preventDefault();
            await autoTagPerformer(performerID);
        });
        menu.appendChild(autoTagLink);

        document.body.appendChild(menu);
        return menu;
    }

    // Function to show the custom menu
    function showCustomMenu(event, performerID) {
        if (currentMenu) currentMenu.remove();
        const menu = createCustomMenu(performerID);
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

    // Function to handle right-click on performer cards
    document.addEventListener('contextmenu', function(event) {
        const performerCard = event.target.closest('.performer-card');
        if (performerCard) {
            const performerLink = performerCard.querySelector('a');
            if (performerLink) {
                const performerID = getPerformerID(performerLink.href);
                if (performerID) showCustomMenu(event, performerID);
            }
        }
    });

    // GraphQL request functions
    async function graphqlRequest(query, variables = {}, apiKey = '') {
        const response = await fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Apikey': apiKey
            },
            body: JSON.stringify({ query, variables })
        });
        return response.json();
    }

    async function gqlQuery(endpoint, query, variables = {}, apiKey = '') {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: 'POST',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'Apikey': apiKey
                },
                data: JSON.stringify({ query, variables }),
                onload: function(response) {
                    resolve(JSON.parse(response.responseText));
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Store the currently opened right-click menu to close it if another right-click occurs
    let currentMenu = null;

})();
