(async function () {
    'use strict';

    if (window.newReleaseTrackerPluginLoaded) {
        console.log("New Release Tracker Plugin is already loaded");
        return;
    }
    window.newReleaseTrackerPluginLoaded = true;

    /**
     * CONFIGURATION
     */
    const storedDateRange = localStorage.getItem('newReleaseDateRange');
    const config = {
        baseURL: window.location.origin,
        localEndpoint: `${window.location.origin}/graphql`,
        stashDBEndpoint: 'https://stashdb.org/graphql',
        stashDBApiKey: null,
        apiKey: localStorage.getItem('apiKey') || null,
        defaultDateRange: storedDateRange ? parseInt(storedDateRange, 10) : 7,
    };

    /**
     * Utility Function to Wait for Elements
     */
    function waitForElement(selector, callback) {
        const observer = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches(selector)) {
                            callback(node);
                        }
                        // Recursively check child nodes
                        node.querySelectorAll && node.querySelectorAll(selector).forEach(callback);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Function to stop observing
        function stopObserving() {
            observer.disconnect();
        }

        return stopObserving;
    }

    /**
     * Debounce Function to Limit Frequency of Function Execution
     */
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(null, args);
            }, delay);
        };
    };

    /**
     * GraphQL Query Functions
     */
    const gqlHeaders = (endpoint) => {
        const headers = { 'Content-Type': 'application/json' };
        if (endpoint === config.localEndpoint && config.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`;
        } else if (endpoint === config.stashDBEndpoint && config.stashDBApiKey) {
            // Use Apikey header since that worked in Postman
            headers['Apikey'] = config.stashDBApiKey;
        }
        return headers;
    };

    const performGraphQLQuery = async (endpoint, query, variables = {}) => {

        if (endpoint === config.stashDBEndpoint) {
            console.log(`Using StashDB API key: ${config.stashDBApiKey}`);
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: gqlHeaders(endpoint),
                body: JSON.stringify({ query, variables }),
            });
            const data = await response.json();
            return data?.data || null;
        } catch (error) {
            console.error(`GraphQL Query Error at ${endpoint}:`, error);
            return null;
        }
    };

    /**
     * Retrieve StashDB API Key from Local Configuration
     */
    const getStashDBApiKey = async () => {
        const query = `
            query Configuration {
                configuration {
                    general {
                        stashBoxes {
                            endpoint
                            api_key
                            name
                        }
                    }
                }
            }
        `;
        const result = await performGraphQLQuery(config.localEndpoint, query);
        const stashDB = result?.configuration?.general?.stashBoxes?.find(
            (box) => box.endpoint === config.stashDBEndpoint
        );
        if (stashDB) {
            config.stashDBApiKey = stashDB.api_key;
            console.log("StashDB API key retrieved successfully:", config.stashDBApiKey);
        } else {
            console.warn("StashDB API key not found in local Stash configuration");
        }
    };

    /**
     * Batch Retrieve StashDB IDs for Multiple Performers
     */
    const getPerformerStashIDs = async (performerIds) => {
        if (performerIds.length === 0) return {};

        // Construct a GraphQL query with aliases for each performer
        const aliases = performerIds.map((id, index) => `performer${index}`);
        const query = `
            query BatchFindPerformers {
                ${aliases.map((alias, index) => `
                    ${alias}: findPerformer(id: ${performerIds[index]}) {
                        stash_ids {
                            endpoint
                            stash_id
                        }
                    }
                `).join('\n')}
            }
        `;

        const result = await performGraphQLQuery(config.localEndpoint, query);
        const performerStashMap = {};

        aliases.forEach((alias, index) => {
            const stashId = result?.[alias]?.stash_ids?.find(
                (id) => id.endpoint === config.stashDBEndpoint
            )?.stash_id;
            performerStashMap[performerIds[index]] = stashId;
        });

        return performerStashMap;
    };

    /**
     * Batch Retrieve New Releases for Multiple StashIDs
     */
    const getNewReleasesForStashIDs = async (stashIds) => {
        if (stashIds.length === 0) return {};

        // Construct a GraphQL query with aliases for each stashId
        const aliases = stashIds.map((id, index) => `stash${index}`);
        const query = `
            query BatchFindPerformers {
                ${aliases.map((alias, index) => `
                    ${alias}: findPerformer(id: "${stashIds[index]}") {
                        scenes {
                            id
                            title
                            release_date
                        }
                    }
                `).join('\n')}
            }
        `;

        const result = await performGraphQLQuery(config.stashDBEndpoint, query);
        const stashScenesMap = {};

        aliases.forEach((alias, index) => {
            const scenes = result?.[alias]?.scenes || [];
            stashScenesMap[stashIds[index]] = scenes;
        });

        return stashScenesMap;
    };

    /**
     * Add New Release Icon Positioned on the Right Edge
     */
    const addNewReleaseIcon = (card, stashId) => {
        if (card.querySelector('.fa-bell')) {
            console.log("Bell icon already exists in this card. Skipping adding another.");
            return;
        }

        const iconContainer = document.createElement('a');
        iconContainer.href = `https://stashdb.org/performers/${stashId}`;
        iconContainer.target = '_blank';
        iconContainer.rel = 'noopener noreferrer';
        iconContainer.title = 'New Release Available on StashDB!';

        iconContainer.innerHTML = `
            <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="bell" 
                 class="svg-inline--fa fa-bell fa-icon" role="img" xmlns="http://www.w3.org/2000/svg" 
                 viewBox="0 0 448 512" style="color: white; width: 18px; height: 18px;">
              <path fill="currentColor" d="M224 512c35.3 0 63.9-28.6 63.9-63.9H160.1c0 35.3 
                 28.6 63.9 63.9 63.9zm215.9-149.3c-19.2-20.9-55.5-52.5-55.5-154.7 
                 0-77.7-54.5-139.3-127.9-155.2V32c0-17.7-14.3-32-32-32s-32 
                 14.3-32 32v20.8C117.5 68.7 63 130.4 63 208c0 102.2-36.3 133.8-55.5 
                 154.7-6 6.6-9.5 15.2-9.5 24.3 0 18 14.6 32 32.6 32h415.7c18 0 
                 32.6-14 32.6-32 0-9.1-3.4-17.7-9.5-24.3z"/>
            </svg>
        `;

        // Add a custom container to position the icon
        const iconWrapper = document.createElement('div');
        iconWrapper.style.position = 'absolute';
        iconWrapper.style.top = '10px'; // Adjust as needed for your card design
        iconWrapper.style.right = '10px'; // Align to the right edge
        iconWrapper.style.zIndex = '10'; // Ensure it is above other elements

        iconWrapper.appendChild(iconContainer);

        // Ensure the card's parent container is set to `position: relative` for proper positioning
        const cardSection = card.querySelector('.card-section');
        if (cardSection) {
            cardSection.style.position = 'relative';
            cardSection.appendChild(iconWrapper);
        }
    };

    /**
     * Keep track of processed performers to avoid duplicate queries
     */
    const processedPerformers = new Set();

    /**
     * Process Performer Cards with Batch Queries
     */
    const processPerformerCards = debounce(async () => {
        console.log("processPerformerCards() called");

        // Introduce a delay before processing performer cards
        await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay

        const performerCards = document.querySelectorAll('.performer-card');
        if (!performerCards.length) {
            console.log("No performer cards found on this page.");
            return;
        }

        console.log(`Found ${performerCards.length} performer cards.`);

        // Collect performerIds that have not been processed
        const performerIds = [];
        performerCards.forEach(card => {
            const performerHref = card.querySelector('a')?.getAttribute('href');
            const performerId = performerHref?.match(/\/performers\/(\d+)/)?.[1];

            if (performerId && !processedPerformers.has(performerId)) {
                performerIds.push(performerId);
            }
        });

        if (performerIds.length === 0) {
            console.log("No new performers to process.");
            return;
        }

        console.log(`Processing ${performerIds.length} new performers.`);

        // Batch query to get stashIds for all performerIds
        const performerStashMap = await getPerformerStashIDs(performerIds);

        // Filter out performers without stashId
        const validPerformers = performerIds.filter(id => performerStashMap[id]);

        if (validPerformers.length === 0) {
            console.log("No valid stashIds found for the new performers.");
            return;
        }

        // Collect all stashIds
        const stashIds = validPerformers.map(id => performerStashMap[id]);

        // Batch query to get new releases for all stashIds
        const stashScenesMap = await getNewReleasesForStashIDs(stashIds);

        // Iterate through each performer and update the card if there are new releases
        validPerformers.forEach(performerId => {
            const stashId = performerStashMap[performerId];
            const newReleases = stashScenesMap[stashId] || [];

            // Filter new releases based on the date range
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - config.defaultDateRange);
            const filteredReleases = newReleases.filter(scene => new Date(scene.release_date) > cutoffDate);

            if (filteredReleases.length > 0) {
                // Find the corresponding card
                const card = Array.from(performerCards).find(card => {
                    const performerHref = card.querySelector('a')?.getAttribute('href');
                    const id = performerHref?.match(/\/performers\/(\d+)/)?.[1];
                    return id === performerId;
                });

                if (card) {
                    addNewReleaseIcon(card, stashId);
                }
            }

            // Mark performer as processed
            processedPerformers.add(performerId);
        });
    }, 300); // Debounce delay of 300ms

    /**
     * Modal for Setting New Release Date Range
     */
    const createModal = () => {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.style.position = 'fixed';
        modalBackdrop.style.top = '0';
        modalBackdrop.style.left = '0';
        modalBackdrop.style.width = '100%';
        modalBackdrop.style.height = '100%';
        modalBackdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modalBackdrop.style.display = 'flex';
        modalBackdrop.style.justifyContent = 'center';
        modalBackdrop.style.alignItems = 'center';
        modalBackdrop.style.zIndex = '9999';
        modalBackdrop.style.visibility = 'hidden';

        const modal = document.createElement('div');
        modal.style.backgroundColor = '#1e1e1e';
        modal.style.color = '#ccc';
        modal.style.padding = '20px';
        modal.style.borderRadius = '8px';
        modal.style.width = '300px';
        modal.style.maxWidth = '90%';
        modal.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

        const header = document.createElement('h2');
        header.textContent = 'Set New Release Date Range';
        header.style.marginTop = '0';
        header.style.marginBottom = '10px';
        header.style.color = '#fff';
        modal.appendChild(header);

        const body = document.createElement('div');
        body.innerHTML = `
            <p style="font-size:14px;">
                Enter the number of days to look back for new releases:
            </p>
            <input type="number" id="date-range-input" style="width:100%;padding:5px;" value="${config.defaultDateRange}" min="1" />
        `;
        modal.appendChild(body);

        const footer = document.createElement('div');
        footer.style.marginTop = '20px';
        footer.style.textAlign = 'right';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'btn btn-light';
        saveBtn.style.marginRight = '8px';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'btn btn-secondary';

        footer.appendChild(saveBtn);
        footer.appendChild(closeBtn);
        modal.appendChild(footer);
        modalBackdrop.appendChild(modal);
        document.body.appendChild(modalBackdrop);

        const showModal = () => { modalBackdrop.style.visibility = 'visible'; };
        const hideModal = () => { modalBackdrop.style.visibility = 'hidden'; };

        closeBtn.addEventListener('click', hideModal);
        saveBtn.addEventListener('click', () => {
            const newRange = parseInt(document.getElementById('date-range-input').value, 10);
            if (isNaN(newRange) || newRange < 1) {
                alert("Please enter a valid number of days.");
                return;
            }
            localStorage.setItem('newReleaseDateRange', newRange);
            config.defaultDateRange = newRange;
            hideModal();
            // Re-process cards after changing date range
            processedPerformers.clear();
            processPerformerCards();
        });

        return { show: showModal, hide: hideModal };
    };

    /**
     * Add Navbar Icon to Open Modal
     */
    const addNavbarIcon = (modalInstance) => {
        const parent = document.querySelector('.navbar-buttons');
        if (!parent) return;

        // Create the FA icon button
        const iconBtn = document.createElement('button');
        iconBtn.type = "button";
        iconBtn.className = "btn btn-icon btn-secondary"; // Apply styles to make it look seamless
        iconBtn.style.marginLeft = "8px";
        iconBtn.style.display = "flex";
        iconBtn.style.alignItems = "center";
        iconBtn.style.justifyContent = "center";
        iconBtn.style.width = "36px";
        iconBtn.style.height = "36px";
        iconBtn.style.borderRadius = "50%"; // Circular button for the icon
        iconBtn.style.backgroundColor = "#6c757d"; // Match btn-secondary color
        iconBtn.style.border = "none"; // Remove border

        // Add the FA icon
        iconBtn.innerHTML = `
            <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="calendar-day" 
                 class="svg-inline--fa fa-calendar-day fa-icon" role="img" xmlns="http://www.w3.org/2000/svg" 
                 viewBox="0 0 448 512" style="width: 20px; height: 20px; color: white;">
              <path fill="currentColor" d="M124 0c13.3 0 24 10.7 24 24v24h152V24c0-13.3 10.7-24 24-24s24 10.7 24 24v24h40c35.3 0 64 28.7 64 64v352c0 35.3-28.7 64-64 64H40c-35.3 0-64-28.7-64-64V112c0-35.3 28.7-64 64-64h40V24c0-13.3 10.7-24 24-24zm312 128H12v320c0 8.8 7.2 16 16 16h392c8.8 0 16-7.2 16-16V128zm-80 96c13.3 0 24 10.7 24 24v112c0 13.3-10.7 24-24 24H92c-13.3 0-24-10.7-24-24V248c0-13.3 10.7-24 24-24h264z"/>
            </svg>
        `;

        // Add click event to show the modal
        iconBtn.addEventListener('click', () => {
            modalInstance.show();
        });

        // Append the icon button to the navbar
        parent.appendChild(iconBtn);
    };

    /**
     * Initialize Navbar Observer
     */
    const initializeNavbarObserver = () => {
        
        const observer = new MutationObserver(() => {
            const navbarButtons = document.querySelector('.navbar-buttons');
            if (navbarButtons) {
                
                observer.disconnect();
                const modalInstance = createModal();
                addNavbarIcon(modalInstance); // Use the new FA icon function
            } else {
                console.log(".navbar-buttons not found yet...");
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    };

    /**
     * Initialize Page Change Listener using PluginApi.Event
     */
    const initializePageChangeListener = () => {
        

        // Listen for page changes
        PluginApi.Event.addEventListener("stash:location", () => {
            console.log('Page changed, re-checking for performer page and cards...');
            const newPath = window.location.pathname;
            if (newPath.startsWith('/performers')) {
                console.log("On performers page, initializing performer card processing.");
                // Clear previously processed performers if navigating within performers
                processedPerformers.clear();
                // Use waitForElement to ensure performer cards are loaded
                waitForElement('.performer-card', () => {
                    console.log("Performer card detected, processing...");
                    processPerformerCards();
                });
            }
        });
    };

    /**
     * Initial Setup
     */
    await getStashDBApiKey();
    initializeNavbarObserver();
    initializePageChangeListener();

    // Initial processing if already on the performers page
    if (window.location.pathname.startsWith('/performers')) {
        console.log("On performers page at initial load, processing performer cards.");
        waitForElement('.performer-card', () => {
            console.log("Performer card detected at initial load, processing...");
            processPerformerCards();
        });
    } else {
        console.log("Not on a performers page at initial load. Skipping performer card processing.");
    }

    console.log("New Release Tracker Plugin fully initialized");
})();
