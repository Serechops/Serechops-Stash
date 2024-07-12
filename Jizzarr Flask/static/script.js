document.addEventListener('DOMContentLoaded', function() {
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');
    const siteDetails = document.getElementById('site-details');
    const scenesGrid = document.getElementById('scenes-grid');
    const pagination = document.getElementById('pagination');
    const loadingIndicator = document.getElementById('loading-indicator');
    const searchResults = document.getElementById('search-results');
    const siteCollectionContainer = document.getElementById('site-collection');
    const sceneCollectionContainer = document.getElementById('scene-collection');
    const compareButton = document.getElementById('compare-button');
    const directoryInput = document.getElementById('directory-input');
    const searchStashButton = document.getElementById('search-stash');
    const progressBarContainer = document.getElementById('progress-bar-container');
    const progressBarInner = document.getElementById('progress-bar-inner');

    let progressInterval;

    searchStashButton.addEventListener('click', async function() {
        // Show loading indicator when search-stash button is pressed
        loadingIndicator.classList.remove('hidden');
        progressBarContainer.style.display = 'block';
        updateProgressBar(0);
        startProgressUpdate();

        try {
            const response = await fetch('/populate_from_stash', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${await response.text()}`);
            }

            const result = await response.json();
            console.log('Sites and scenes fetched from Stash:', result);
            Toastify({
                text: 'Sites and scenes successfully populated from Stash.',
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)"
            }).showToast();
            displayCollection(); // Refresh the collection display
        } catch (error) {
            console.error('Error fetching from Stash:', error);
            Toastify({
                text: `Error fetching from Stash: ${error.message}`,
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)"
            }).showToast();
        }

        // Hide loading indicator once fetching is complete
        loadingIndicator.classList.add('hidden');
        progressBarContainer.style.display = 'none';
        clearInterval(progressInterval);
    });

    function startProgressUpdate() {
        progressInterval = setInterval(async () => {
            const response = await fetch('/progress');
            if (response.ok) {
                const progress = await response.json();
                const percentage = Math.round((progress.completed / progress.total) * 100);
                updateProgressBar(percentage);
            }
        }, 10000); // Update progress every second
    }

    function updateProgressBar(percentage) {
        progressBarInner.style.width = percentage + '%';
        progressBarInner.innerText = percentage + '%';
    }

    let currentScenes = [];
    let currentPage = 1;
    const scenesPerPage = 16;

    async function getApiKey() {
        try {
            const response = await fetch('/get_tpdb_api_key');
            if (response.ok) {
                const data = await response.json();
                return data.tpdbApiKey;
            } else {
                console.error('Failed to fetch API key:', response.status);
                return null;
            }
        } catch (error) {
            console.error('Error fetching API key:', error);
            return null;
        }
    }

    // Fetch data from API
    async function fetchData(endpoint) {
        const apiKey = await getApiKey();
        if (!apiKey) {
            console.error('API key is missing');
            return null;
        }
    
        const url = `https://api.theporndb.net/jizzarr/${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${apiKey}`
        };
    
        try {
            const response = await fetch(url, { headers });
            if (response.ok) {
                const data = await response.json();
                console.log(`Data from ${endpoint}:`, data); // Print the API response for debugging
                return data;
            } else {
                console.error(`Failed to fetch data from ${endpoint}: ${response.status}`);
                return null;
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            return null;
        }
    }

    // Search for site by name
    async function searchSiteByName(siteName) {
        const data = await fetchData(`site/search?q=${siteName}`);
        return data ? data : [];
    }

    function displayScenes() {
        scenesGrid.innerHTML = '';
        if (Array.isArray(currentScenes)) {
            const scenesToDisplay = currentScenes.slice(currentPage * scenesPerPage, (currentPage + 1) * scenesPerPage);
            scenesToDisplay.forEach(scene => {
                const sceneElement = document.createElement('div');
                sceneElement.classList.add('scene-card');
                sceneElement.innerHTML = `
                    <img src="${scene.Images.find(img => img.CoverType === 'Screenshot')?.Url}" alt="${scene.Title}">
                    <h3>${scene.Title}</h3>
                    <p><strong>Date:</strong> ${scene.ReleaseDate}</p>
                    <p class="overview"><strong>Overview:</strong> ${scene.Overview}</p>
                    <p><strong>Duration:</strong> ${scene.Duration} minutes</p>
                    <p><strong>Performers:</strong> ${scene.Credits.map(credit => credit.Name).sort().join(', ')}</p>
                `;
                scenesGrid.appendChild(sceneElement);
            });
        } else {
            scenesGrid.innerHTML = '<p>No scenes available</p>';
        }
    }

    function setupPagination() {
        pagination.innerHTML = '';
        if (Array.isArray(currentScenes) && currentScenes.length > 0) {
            const totalPages = Math.ceil(currentScenes.length / scenesPerPage);

            const firstButton = document.createElement('button');
            firstButton.textContent = 'First';
            firstButton.addEventListener('click', () => {
                currentPage = 0;
                displayScenes();
            });

            const prevButton = document.createElement('button');
            prevButton.textContent = 'Previous';
            prevButton.addEventListener('click', () => {
                if (currentPage > 0) {
                    currentPage--;
                    displayScenes();
                }
            });

            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next';
            nextButton.addEventListener('click', () => {
                if (currentPage < totalPages - 1) {
                    currentPage++;
                    displayScenes();
                }
            });

            const lastButton = document.createElement('button');
            lastButton.textContent = 'Last';
            lastButton.addEventListener('click', () => {
                currentPage = totalPages - 1;
                displayScenes();
            });

            pagination.appendChild(firstButton);
            pagination.appendChild(prevButton);
            pagination.appendChild(nextButton);
            pagination.appendChild(lastButton);
        }
    }

    function downloadSiteData(title, scenes) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(scenes, null, 4));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${title}_data.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        document.body.removeChild(downloadAnchorNode);
    }

    // Populate site details and scenes
    async function populateSiteDetails(site) {
        // Show loading indicator when fetching scenes
        loadingIndicator.classList.remove('hidden');

        siteDetails.innerHTML = '';
        scenesGrid.innerHTML = '';
        pagination.innerHTML = '';
        currentScenes = [];

        console.log('Fetching details for site with ForeignId:', site.ForeignId);

        try {
            const siteData = await fetchData(`site/${site.ForeignId}`);
            console.log('Site data received:', siteData);

            if (siteData) {
                const siteDetailsData = siteData;
                console.log('Processing site details data:', siteDetailsData);

                const scenes = siteDetailsData.Episodes || [];
                console.log('Scenes data:', scenes);

                const sceneCount = scenes.length;
                const siteInfo = `
                <div class="site-info">
                    <h2>${siteDetailsData.Title}</h2>
                    <p><strong>URL:</strong> <a href="${siteDetailsData.Homepage}" target="_blank">${siteDetailsData.Homepage}</a></p>
                    <p><strong>Description:</strong> ${siteDetailsData.Overview}</p>
                    <p><strong>Network:</strong> ${siteDetailsData.Network}</p>
                    <p><strong>Status:</strong> ${siteDetailsData.Status}</p>
                    <p><strong>Total Scenes:</strong> ${sceneCount}</p>
                    ${siteDetailsData.Images && siteDetailsData.Images.length > 0 ? `<a href="${siteDetailsData.Homepage}" target="_blank"><img src="${siteDetailsData.Images[0].Url}" alt="${siteDetailsData.Title} Poster"></a>` : `<a href="${siteDetailsData.Homepage}" target="_blank">${siteDetailsData.Title}</a>`}
                    <button id="download-button">Download Site Data</button>
                    <button id="add-site-button">Add Site to Collection</button>
                </div>
                `;
                siteDetails.innerHTML = siteInfo;

                if (scenes.length > 0) {
                    currentScenes = scenes;
                    displayScenes();
                    setupPagination();
                } else {
                    siteDetails.innerHTML += '<p>No scenes available</p>';
                }

                // Add event listeners to buttons
                const downloadButton = document.getElementById('download-button');
                const addSiteButton = document.getElementById('add-site-button');
                downloadButton.addEventListener('click', () => downloadSiteData(siteDetailsData.Title, scenes));
                addSiteButton.addEventListener('click', () => addSiteToCollection(siteDetailsData, scenes));

            } else {
                console.log('No site data found.');
                siteDetails.innerHTML = '<p>No site details available</p>';
            }
        } catch (error) {
            console.error('Error fetching site details:', error);
            siteDetails.innerHTML = `<p>Error fetching site details: ${error.message}</p>`;
        }

        // Hide loading indicator once scenes are populated
        loadingIndicator.classList.add('hidden');
    }

    // Display search results
    function displaySearchResults(sites) {
        searchResults.innerHTML = '';
        sites.forEach(site => {
            const siteCard = document.createElement('div');
            siteCard.classList.add('site-card');
            siteCard.innerHTML = `
                <div class="p-4 md:w-1/5 flex md:justify-end items-center">
                    <img src="${site.Images.find(img => img.CoverType === 'Logo')?.Url}" class="max-h-24" alt="${site.Title}">
                </div>
            `;
            siteCard.addEventListener('click', () => {
                // Show loading indicator when a site is selected
                loadingIndicator.classList.remove('hidden');
                populateSiteDetails(site);
            });
            searchResults.appendChild(siteCard);
        });

        // Hide loading indicator once search results are populated
        loadingIndicator.classList.add('hidden');
    }

    // Add site to collection
    function addSiteToCollection(site, scenes) {
        const siteData = {
            site: {
                uuid: site.ForeignGuid,
                name: site.Title,
                url: site.Homepage,
                description: site.Overview,
                rating: '',
                network: site.Network,
                parent: '',
                logo: site.Images && site.Images.length > 0 ? site.Images.find(img => img.CoverType === 'Logo')?.Url : ''
            },
            scenes: scenes.map(scene => ({
                title: scene.Title,
                date: scene.ReleaseDate,
                duration: scene.Duration,
                image: scene.Images.find(img => img.CoverType === 'Screenshot')?.Url,
                performers: scene.Credits,
                status: scene.status || null,
                local_path: scene.local_path || null,
                year: scene.Year,
                episode_number: scene.EpisodeNumber,
                slug: scene.Slug,
                overview: scene.Overview,
                credits: scene.Credits,
                release_date_utc: scene.ReleaseDateUtc,
                images: scene.Images,
                trailer: scene.Trailer,
                genres: scene.Genres,
                foreign_guid: scene.ForeignGuid,
                foreign_id: scene.ForeignId
            }))
        };
    
        // Save to server-side database
        fetch('/add_site', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(siteData)
        }).then(response => {
            if (!response.ok) {
                throw new Error('Failed to save to server-side database.');
            }
            return response.json();
        }).then(data => {
            console.log('Saved to server-side database:', data);
            Toastify({
                text: `${site.Title} has been added to your collection.`,
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)"
            }).showToast();
            displayCollection(); // Refresh the collection display
        }).catch(error => {
            console.error('Error saving to server-side database:', error);
            Toastify({
                text: 'Failed to add site to collection.',
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)"
            }).showToast();
        });
    }


    // Event listener for search button
    if (searchButton) {
        searchButton.addEventListener('click', async function() {
            const siteName = searchInput.value.trim();
            if (siteName) {
                // Show loading indicator when search button is pressed
                loadingIndicator.classList.remove('hidden');
                const sites = await searchSiteByName(siteName);
                if (sites && sites.length > 0) {
                    displaySearchResults(sites);
                } else {
                    searchResults.innerHTML = '<p>No sites found</p>';
                    // Hide loading indicator if no sites are found
                    loadingIndicator.classList.add('hidden');
                }
            } else {
                searchResults.innerHTML = '<p>Please enter a site name</p>';
                // Hide loading indicator if input is empty
                loadingIndicator.classList.add('hidden');
            }
        });
    }

    // Function to display the collection
    async function displayCollection() {
        siteCollectionContainer.innerHTML = '';

        // Fetch collection from server-side database
        const response = await fetch('/collection_data');
        const siteCollection = await response.json();

        // Display site collection
        siteCollection.forEach(item => {
            const siteCard = document.createElement('div');
            siteCard.classList.add('site-card');
            siteCard.innerHTML = `
                <h2>${item.site.name}</h2>
                ${item.site.poster ? `<img src="${item.site.poster}" alt="${item.site.name} Poster">` : ''}
                <p>${item.site.description}</p>
                <button class="remove-site-button" data-site-uuid="${item.site.uuid}">Remove Site</button>
                <div class="site-scenes">
                    ${item.scenes.map(scene => `
                        <div class="scene-row">
                            <div class="scene-info">
                                <p><strong>${scene.title}</strong></p>
                                <p><strong>Release Date:</strong> ${new Date(scene.date).toLocaleDateString()}</p>
                                <p><strong>Duration:</strong> ${scene.duration} minutes</p>
                                <p><strong>Performers:</strong> ${scene.performers}</p>
                                <p class="status ${scene.status === 'Found' ? 'found' : 'missing'}">${scene.status}</p>
                                <button class="match-button" data-scene-id="${scene.id}">Match</button>
                            </div>
                            <div class="scene-preview hidden">
                                <img src="${scene.image}" alt="${scene.title}">
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            siteCard.querySelectorAll('.scene-row').forEach(row => {
                row.addEventListener('click', () => {
                    const preview = row.querySelector('.scene-preview');
                    preview.classList.toggle('hidden');
                });
            });
            siteCollectionContainer.appendChild(siteCard);
        });

        // Add event listeners to remove buttons
        const removeSiteButtons = document.querySelectorAll('.remove-site-button');
        removeSiteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const siteUuid = e.target.getAttribute('data-site-uuid');
                removeSiteFromCollection(siteUuid);
            });
        });

        // Add event listeners to match buttons
        const matchButtons = document.querySelectorAll('.match-button');
        matchButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const sceneId = e.target.getAttribute('data-scene-id');
                handleMatchButtonClick(sceneId);
            });
        });
    }

    // Remove site from collection
    function removeSiteFromCollection(siteUuid) {
        fetch(`/remove_site/${siteUuid}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                console.log('Site removed:', data);
                Toastify({
                    text: 'Site has been removed from your collection.',
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)"
                }).showToast();
                displayCollection(); // Update the display
            })
            .catch(error => {
                console.error('Error removing site from collection:', error);
                Toastify({
                    text: 'Failed to remove site from collection.',
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)"
                }).showToast();
            });
    }

    // Handle match button click
    function handleMatchButtonClick(sceneId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.mp4';
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (file) {
                try {
                    const response = await fetch('/match_scene', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ scene_id: sceneId, file_path: file.path })
                    });

                    const result = await response.json();
                    if (response.ok) {
                        Toastify({
                            text: result.message,
                            duration: 3000,
                            close: true,
                            gravity: "top",
                            position: "right",
                            backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)"
                        }).showToast();
                        displayCollection();
                    } else {
                        throw new Error(result.error);
                    }
                } catch (error) {
                    console.error('Error matching scene:', error);
                    Toastify({
                        text: 'Error matching scene: ' + error.message,
                        duration: 3000,
                        close: true,
                        gravity: "top",
                        position: "right",
                        backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)"
                    }).showToast();
                }
            }
        };
        input.click();
    }

    // Compare collection with local directory
    function compareCollection(siteUuid, localDirectory) {
        fetch('/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ siteUuid, localDirectory })
        }).then(response => response.json())
        .then(data => {
            console.log('Comparison results:', data);
            updateTableWithComparison(data.missing_files, data.matched_files);
        }).catch(error => {
            console.error('Error comparing collection:', error);
        });
    }

    function updateTableWithComparison(missingFiles, matchedFiles) {
        // Fetch updated collection from server-side database
        fetch('/collection_data')
            .then(response => response.json())
            .then(siteCollection => {
                siteCollection.forEach(siteData => {
                    siteData.scenes.forEach(scene => {
                        const sceneFileName = `${siteData.site.name} - ${scene.title} - ${scene.date}.mp4`;
                        if (missingFiles.includes(sceneFileName)) {
                            scene.status = 'Missing';
                        } else if (matchedFiles.includes(sceneFileName)) {
                            scene.status = 'Found';
                        } else {
                            scene.status = 'Unknown';
                        }
                    });
                });
                displayCollection();
            })
            .catch(error => {
                console.error('Error fetching updated collection:', error);
            });
    }

    // Event listener for the compare button
    if (compareButton) {
        compareButton.addEventListener('click', () => {
            const siteCard = document.querySelector('.site-card.active');
            if (siteCard) {
                const siteUuid = siteCard.getAttribute('data-site-uuid');
                const localDirectory = directoryInput.files[0].webkitRelativePath.split('/')[0];
                compareCollection(siteUuid, localDirectory);
            } else {
                Toastify({
                    text: 'Please select a site first.',
                    duration: 3000,
                    close: true,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)"
                }).showToast();
            }
        });
    }

    // Add event listeners to directory input
    if (directoryInput) {
        directoryInput.addEventListener('change', () => {
            console.log('Directory selected:', directoryInput.files);
        });
    }

    // Load collection when collection page is loaded
    if (window.location.pathname.endsWith('collection.html')) {
        displayCollection();
    }
});
