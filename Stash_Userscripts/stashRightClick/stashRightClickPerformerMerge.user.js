// ==UserScript==
// @name         stashRightClickPerformerMerge
// @namespace    https://github.com/Serechops/Serechops-Stash
// @version      1.5
// @description  Adds a performer merge tool to the Performers page in Stash.
// @match        http://localhost:9999/performers*
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @connect      localhost
// @require      https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js
// @downloadURL  https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/stashRightClickPerformerMerge.user.js
// @updateURL    https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/stashRightClickPerformerMerge.user.js
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

    // Friendly names for endpoints
    const friendlyEndpoints = {
        "https://stashdb.org/graphql": "StashDB",
        "https://theporndb.net/graphql": "ThePornDB"
    };

    // Inject CSS for the custom modal and styling
    GM_addStyle(`
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
            color: white;
            text-decoration: none;
        }

        #custom-menu a:hover {
            text-decoration: underline;
        }

        #merge-modal {
            display: none;
            position: fixed;
            z-index: 10001;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0, 0, 0, 0.5);
        }

        .merge-modal-content {
            background: rgba(0, 0, 0, 0.3);
            margin: 5% auto;
            padding: 20px;
            border: 1px solid #888;
            width: 80%;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
        }

        .merge-close {
            color: red;
            float: right;
            font-size: 28px;
            font-weight: bold;
        }

        .merge-close:hover,
        .merge-close:focus {
            color: red;
            text-decoration: none;
            cursor: pointer;
        }

        .merge-header {
            text-align: center;
            font-size: 24px;
            margin-bottom: 20px;
        }

        .merge-search {
            margin-bottom: 20px;
        }

        .merge-search input {
            width: 100%;
            padding: 10px;
            margin-bottom: 10px;
            color: black;
        }

        .merge-container {
            display: flex;
            justify-content: space-between;
        }

        .merge-pane {
            width: 48%;
            background-color: rgba(0, 0, 0, 0.5);
            padding: 10px;
            border-radius: 8px;
            border: 1px solid #ccc;
        }

        .merge-pane img {
            display: block;
            margin: 0 auto 10px auto;
            max-width: 100px;
            max-height: 100px;
            border-radius: 8px;
        }

        .merge-pane .performer-result {
            padding: 8px;
            margin: 5px 0;
            background-color: rgba(0, 0, 0, 0.5);
            border: 1px solid #ccc;
            border-radius: 5px;
            cursor: pointer;
            text-align: center;
        }

        .merge-pane .performer-result:hover {
            background-color: green;
        }

        .merge-button {
            margin-top: 10px;
            padding: 10px;
            background-color: #333;
            color: #fff;
            border: none;
            cursor: pointer;
        }

        .merge-button:hover {
            background-color: #444;
        }

        .merge-actions {
            text-align: center;
            margin-top: 20px;
        }

        .highlight {
            background-color: #B03608;
        }
    `);

    // Function to create the custom menu
    function createCustomMenu(event) {
        const menu = document.createElement('div');
        menu.id = 'custom-menu';

        const mergePerformersLink = document.createElement('a');
        mergePerformersLink.href = '#';
        mergePerformersLink.textContent = 'Merge Performers';
        mergePerformersLink.addEventListener('click', async function(e) {
            e.preventDefault();
            menu.remove();
            await showMergeModal();
        });
        menu.appendChild(mergePerformersLink);

        document.body.appendChild(menu);

        // Adjust menu position to align to the left of the cursor
        const menuWidth = menu.offsetWidth;
        const menuLeft = event.pageX - menuWidth;
        const menuTop = event.pageY;

        menu.style.top = `${menuTop}px`;
        menu.style.left = `${menuLeft}px`;

        const handleClickOutside = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', handleClickOutside);
            }
        };

        document.addEventListener('click', handleClickOutside);
    }

    // Function to show the merge modal
    async function showMergeModal() {
        const modal = document.createElement('div');
        modal.id = 'merge-modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'merge-modal-content';

        const header = document.createElement('div');
        header.className = 'merge-header';
        header.textContent = 'Merge Performers';
        modalContent.appendChild(header);

        const closeButton = document.createElement('span');
        closeButton.className = 'merge-close';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = () => {
            modal.style.display = 'none';
            modal.remove();
        };
        modalContent.appendChild(closeButton);

        const searchContainer = document.createElement('div');
        searchContainer.className = 'merge-search';
        searchContainer.innerHTML = `
            <input type="text" id="performer-search-left" placeholder="Search Performer by Name or Stash ID (Left)">
            <input type="text" id="performer-search-right" placeholder="Search Performer by Name or Stash ID (Right)">
        `;
        modalContent.appendChild(searchContainer);

        const container = document.createElement('div');
        container.className = 'merge-container';
        container.innerHTML = `
            <div class="merge-pane" id="merge-pane-left"></div>
            <div class="merge-pane" id="merge-pane-right"></div>
        `;
        modalContent.appendChild(container);

        const actions = document.createElement('div');
        actions.className = 'merge-actions';
        actions.innerHTML = `
            <button class="merge-button" id="merge-left-to-right">Merge Left to Right</button>
            <button class="merge-button" id="merge-right-to-left">Merge Right to Left</button>
        `;
        modalContent.appendChild(actions);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        modal.style.display = 'block';

        document.getElementById('performer-search-left').addEventListener('input', async (e) => {
            const searchQuery = e.target.value;
            if (searchQuery.length >= 3) {
                const performers = await searchPerformers(searchQuery);
                updateMergePane('merge-pane-left', performers);
            }
        });

        document.getElementById('performer-search-right').addEventListener('input', async (e) => {
            const searchQuery = e.target.value;
            if (searchQuery.length >= 3) {
                const performers = await searchPerformers(searchQuery);
                updateMergePane('merge-pane-right', performers);
            }
        });

        document.getElementById('merge-left-to-right').addEventListener('click', () => mergePerformers('left-to-right'));
        document.getElementById('merge-right-to-left').addEventListener('click', () => mergePerformers('right-to-left'));
    }

    // Function to search performers
    async function searchPerformers(query) {
        let gqlQuery;
        let variables;

        // Determine if the query is a stash_id or a name
        if (/^[0-9a-fA-F-]{36}$/.test(query)) {
            gqlQuery = `
                query FindPerformers($stash_id: String!) {
                    findPerformers(
                        performer_filter: {
                            stash_id_endpoint: {
                                stash_id: $stash_id,
                                modifier: INCLUDES
                            }
                        },
                        filter: { per_page: -1, direction: ASC }
                    ) {
                        performers {
                            id
                            name
                            disambiguation
                            url
                            gender
                            twitter
                            instagram
                            birthdate
                            ethnicity
                            country
                            eye_color
                            height_cm
                            measurements
                            fake_tits
                            career_length
                            tattoos
                            piercings
                            alias_list
                            image_path
                            movie_count
                            performer_count
                            o_counter
                            rating100
                            details
                            death_date
                            hair_color
                            weight
                            created_at
                            updated_at
                            gallery_count
                            scene_count
                            stash_ids {
                                endpoint
                                stash_id
                            }
                        }
                    }
                }
            `;
            variables = { stash_id: query };
        } else {
            gqlQuery = `
                query FindPerformers($filter: String!) {
                    findPerformers(
                        performer_filter: { name: { value: $filter, modifier: INCLUDES } },
                        filter: { per_page: -1, direction: ASC }
                    ) {
                        performers {
                            id
                            name
                            disambiguation
                            url
                            gender
                            twitter
                            instagram
                            birthdate
                            ethnicity
                            country
                            eye_color
                            height_cm
                            measurements
                            fake_tits
                            career_length
                            tattoos
                            piercings
                            alias_list
                            image_path
                            movie_count
                            performer_count
                            o_counter
                            rating100
                            details
                            death_date
                            hair_color
                            weight
                            created_at
                            updated_at
                            gallery_count
                            scene_count
                            stash_ids {
                                endpoint
                                stash_id
                            }
                        }
                    }
                }
            `;
            variables = { filter: query };
        }

        try {
            const response = await graphqlRequest(gqlQuery, variables, config.apiKey);
            return response.data.findPerformers.performers;
        } catch (error) {
            console.error('Error searching performers:', error);
            return [];
        }
    }

    // Function to update the merge pane with search results
    function updateMergePane(paneId, performers) {
        const pane = document.getElementById(paneId);
        pane.innerHTML = '';
        performers.forEach(performer => {
            const performerDiv = document.createElement('div');
            performerDiv.className = 'performer-result';
            performerDiv.textContent = performer.name;
            performerDiv.onclick = () => selectPerformer(paneId, performer);
            pane.appendChild(performerDiv);
        });
    }

    // Function to select a performer for comparison
    function selectPerformer(paneId, performer) {
        const pane = document.getElementById(paneId);
        const stashIds = performer.stash_ids.map(id => `${friendlyEndpoints[id.endpoint] || id.endpoint}: ${id.stash_id}`).join(', ');

        pane.innerHTML = `
            <img src="${performer.image_path}/image.jpg" alt="${performer.name}">
            <h3>${performer.name}</h3>
            <div data-field="name"><strong>ID:</strong> ${performer.id}</div>
            <div data-field="disambiguation"><strong>Disambiguation:</strong> ${performer.disambiguation}</div>
            <div data-field="url"><strong>URL:</strong> <a href="${performer.url}" target="_blank">${performer.url}</a></div>
            <div data-field="gender"><strong>Gender:</strong> ${performer.gender}</div>
            <div data-field="twitter"><strong>Twitter:</strong> ${performer.twitter}</div>
            <div data-field="instagram"><strong>Instagram:</strong> ${performer.instagram}</div>
            <div data-field="birthdate"><strong>Birthdate:</strong> ${performer.birthdate}</div>
            <div data-field="ethnicity"><strong>Ethnicity:</strong> ${performer.ethnicity}</div>
            <div data-field="country"><strong>Country:</strong> ${performer.country}</div>
            <div data-field="eye_color"><strong>Eye Color:</strong> ${performer.eye_color}</div>
            <div data-field="height_cm"><strong>Height (cm):</strong> ${performer.height_cm}</div>
            <div data-field="measurements"><strong>Measurements:</strong> ${performer.measurements}</div>
            <div data-field="fake_tits"><strong>Fake Tits:</strong> ${performer.fake_tits}</div>
            <div data-field="career_length"><strong>Career Length:</strong> ${performer.career_length}</div>
            <div data-field="tattoos"><strong>Tattoos:</strong> ${performer.tattoos}</div>
            <div data-field="piercings"><strong>Piercings:</strong> ${performer.piercings}</div>
            <div data-field="alias_list"><strong>Aliases:</strong> ${performer.alias_list.join(', ')}</div>
            <div data-field="scene_count"><strong>Scene Count:</strong> ${performer.scene_count}</div>
            <div data-field="image_count"><strong>Image Count:</strong> ${performer.image_count}</div>
            <div data-field="gallery_count"><strong>Gallery Count:</strong> ${performer.gallery_count}</div>
            <div data-field="movie_count"><strong>Movie Count:</strong> ${performer.movie_count}</div>
            <div data-field="performer_count"><strong>Performer Count:</strong> ${performer.performer_count}</div>
            <div data-field="o_counter"><strong>O Counter:</strong> ${performer.o_counter}</div>
            <div data-field="rating100"><strong>Rating:</strong> ${performer.rating100 / 10}/10</div>
            <div data-field="details"><strong>Details:</strong> ${performer.details}</div>
            <div data-field="death_date"><strong>Death Date:</strong> ${performer.death_date}</div>
            <div data-field="hair_color"><strong>Hair Color:</strong> ${performer.hair_color}</div>
            <div data-field="weight"><strong>Weight:</strong> ${performer.weight}</div>
            <div data-field="created_at"><strong>Created At:</strong> ${performer.created_at}</div>
            <div data-field="updated_at"><strong>Updated At:</strong> ${performer.updated_at}</div>
            <div data-field="stash_ids"><strong>Stash IDs:</strong> ${stashIds}</div>
        `;
        pane.dataset.selectedPerformerId = performer.id;
        pane.dataset.selectedPerformerData = JSON.stringify(performer);

        // Highlight differences if both panes have performers selected
        if (document.getElementById('merge-pane-left').dataset.selectedPerformerId && document.getElementById('merge-pane-right').dataset.selectedPerformerId) {
            highlightDifferences();
        }
    }

    // Function to highlight differences between two selected performers
    function highlightDifferences() {
        const leftPane = document.getElementById('merge-pane-left');
        const rightPane = document.getElementById('merge-pane-right');

        const leftPerformer = JSON.parse(leftPane.dataset.selectedPerformerData);
        const rightPerformer = JSON.parse(rightPane.dataset.selectedPerformerData);

        const fields = [
            'name', 'disambiguation', 'url', 'gender', 'twitter', 'instagram',
            'birthdate', 'ethnicity', 'country', 'eye_color', 'height_cm',
            'measurements', 'fake_tits', 'career_length', 'tattoos', 'piercings',
            'alias_list', 'scene_count', 'image_count', 'gallery_count', 'movie_count',
            'performer_count', 'o_counter', 'rating100', 'details', 'death_date',
            'hair_color', 'weight', 'created_at', 'updated_at', 'stash_ids'
        ];

        fields.forEach(field => {
            const leftFieldElement = leftPane.querySelector(`[data-field="${field}"]`);
            const rightFieldElement = rightPane.querySelector(`[data-field="${field}"]`);

            if (leftFieldElement && rightFieldElement && JSON.stringify(leftPerformer[field]) !== JSON.stringify(rightPerformer[field])) {
                leftFieldElement.classList.add('highlight');
                rightFieldElement.classList.add('highlight');
            } else {
                if (leftFieldElement) leftFieldElement.classList.remove('highlight');
                if (rightFieldElement) rightFieldElement.classList.remove('highlight');
            }
        });
    }

    // Function to merge performers
    async function mergePerformers(direction) {
        const leftPane = document.getElementById('merge-pane-left');
        const rightPane = document.getElementById('merge-pane-right');
        const leftPerformerId = leftPane.dataset.selectedPerformerId;
        const rightPerformerId = rightPane.dataset.selectedPerformerId;

        if (!leftPerformerId || !rightPerformerId) {
            showToast('Please select performers to merge', 'error');
            return;
        }

        const sourcePerformerId = direction === 'left-to-right' ? leftPerformerId : rightPerformerId;
        const targetPerformerId = direction === 'left-to-right' ? rightPerformerId : leftPerformerId;

        try {
            const sourcePerformer = await fetchPerformerDetails(sourcePerformerId);
            const targetPerformer = await fetchPerformerDetails(targetPerformerId);

            const updatedData = { id: targetPerformerId };
            const appendedStashIds = [...targetPerformer.stash_ids, ...sourcePerformer.stash_ids].reduce((acc, id) => {
                const existing = acc.find(e => e.stash_id === id.stash_id);
                if (!existing) acc.push(id);
                return acc;
            }, []);

            for (const key in sourcePerformer) {
                if (key === 'alias_list') {
                    // Merge unique aliases
                    const mergedAliases = Array.from(new Set([...targetPerformer.alias_list, ...sourcePerformer.alias_list]));
                    updatedData.alias_list = mergedAliases;
                } else if (key === 'disambiguation') {
                    // Merge disambiguations
                    const mergedDisambiguation = targetPerformer.disambiguation
                        ? `${targetPerformer.disambiguation}, ${sourcePerformer.disambiguation}`
                        : sourcePerformer.disambiguation;
                    updatedData.disambiguation = mergedDisambiguation;
                } else if (key === 'stash_ids') {
                    // Append stash IDs
                    updatedData.stash_ids = appendedStashIds;
                } else if (!targetPerformer[key] && sourcePerformer[key]) {
                    updatedData[key] = sourcePerformer[key];
                }
            }

            console.log('Updated Data for Mutation:', updatedData); // Log the mutation data

            await updatePerformer(updatedData);
            await deletePerformer(sourcePerformerId);
            showToast('Performers merged successfully', 'success');
            document.getElementById('merge-modal').remove();
        } catch (error) {
            if (error.message.includes("performer with name") && error.message.includes("already exists")) {
                showToast('Merge failed: Performer with the same name and disambiguation already exists.', 'error');
            } else {
                console.error('Error merging performers:', error);
                showToast('Error merging performers', 'error');
            }
        }
    }

    // Function to fetch performer details
    async function fetchPerformerDetails(performerId) {
        const gqlQuery = `
            query FindPerformer($id: ID!) {
                findPerformer(id: $id) {
                    id
                    name
                    disambiguation
                    url
                    gender
                    twitter
                    instagram
                    birthdate
                    ethnicity
                    country
                    eye_color
                    height_cm
                    measurements
                    fake_tits
                    career_length
                    tattoos
                    piercings
                    alias_list
                    image_path
                    scene_count
                    image_count
                    gallery_count
                    movie_count
                    performer_count
                    o_counter
                    rating100
                    details
                    death_date
                    hair_color
                    weight
                    created_at
                    updated_at
                    stash_ids {
                        endpoint
                        stash_id
                    }
                }
            }
        `;
        const variables = { id: performerId };
        const response = await graphqlRequest(gqlQuery, variables, config.apiKey);
        const performer = response.data.findPerformer;
        const pane = document.querySelector(`[data-selected-performer-id="${performerId}"]`);
        if (pane) {
            pane.dataset.selectedPerformerData = JSON.stringify(performer);
        }
        return performer;
    }

    // Function to update performer
    async function updatePerformer(performerData) {
        const gqlMutation = `
            mutation PerformerUpdate($input: PerformerUpdateInput!) {
                performerUpdate(input: $input) {
                    id
                }
            }
        `;
        const input = performerData;

        console.log('GraphQL Mutation:', gqlMutation); // Log the mutation query
        console.log('Mutation Variables:', { input }); // Log the mutation variables

        const response = await graphqlRequest(gqlMutation, { input }, config.apiKey);

        console.log('GraphQL Response:', response); // Log the mutation response

        if (response.errors) {
            console.error('Mutation Errors:', response.errors);
        }
    }

    // Function to delete performer
    async function deletePerformer(performerId) {
        const gqlMutation = `
            mutation PerformerDestroy($input: PerformerDestroyInput!) {
                performerDestroy(input: $input)
            }
        `;
        const input = { id: performerId };

        console.log('Delete Mutation:', gqlMutation); // Log the delete mutation query
        console.log('Delete Variables:', { input }); // Log the delete mutation variables

        const response = await graphqlRequest(gqlMutation, { input }, config.apiKey);

        console.log('Delete Response:', response); // Log the delete mutation response

        if (response.errors) {
            console.error('Mutation Errors:', response.errors);
        }
    }

    // GraphQL request function
    async function graphqlRequest(query, variables = {}, apiKey = '') {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Apikey': apiKey
            },
            body: JSON.stringify({ query, variables })
        });
        return response.json();
    }

    const config = {
        serverUrl: apiUrl,
        apiKey: userConfig.apiKey
    };

    // Function to show toast notifications
    function showToast(message, type = "success") {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "center",
            backgroundColor: type === "success" ? "green" : "red",
        }).showToast();
    }

    // Function to handle right-click on the dropdown menu button
    document.addEventListener('contextmenu', function(event) {
        const dropdownButton = event.target.closest('button#more-menu');
        if (dropdownButton) {
            event.preventDefault();
            createCustomMenu(event);
        }
    });

})();
