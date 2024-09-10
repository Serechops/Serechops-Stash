/******************************************
 * USER CONFIGURATION
 ******************************************/
const userConfig = {
    scheme: 'http', // or 'https'
    host: 'localhost', // your server IP or hostname
    port: 9999, // your server port
    apiKey: '', // your API key for local Stash server
};

/******************************************
 * SCRIPT BEGINS HERE
 ******************************************/
(async function () {
    'use strict';

    // Construct the GraphQL endpoint based on user configuration
    const graphqlEndpoint = `${userConfig.scheme}://${userConfig.host}:${userConfig.port}/graphql`;

    // GraphQL query to fetch female performers for a studio
    const query = `query FindPerformers($studioId: [ID!]) {
        findPerformers(
            performer_filter: {
                studios: { value: $studioId, modifier: INCLUDES }
                gender: { value: FEMALE, modifier: EQUALS }
            }
            filter: { per_page: -1 }
        ) {
            performers {
                id
                name
                scene_count
            }
        }
    }`;

    // Function to save data to localStorage
    const saveToLocalStorage = (studioId, data) => {
        localStorage.setItem(`studio_${studioId}_performers`, JSON.stringify(data));
    };

    // Function to load data from localStorage
    const loadFromLocalStorage = (studioId) => {
        const data = localStorage.getItem(`studio_${studioId}_performers`);
        return data ? JSON.parse(data) : null;
    };

    // Fetch the performers for a studio
    const fetchPerformers = async (studioId) => {
        // Check localStorage first
        const cachedPerformers = loadFromLocalStorage(studioId);
        if (cachedPerformers) {
            return cachedPerformers;
        }

        const requestBody = {
            query: query,
            variables: { studioId: [studioId] }
        };

        try {
            const response = await fetch(graphqlEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(userConfig.apiKey ? { 'Authorization': `Apikey ${userConfig.apiKey}` } : {}) // Only add API key if provided
                },
                body: JSON.stringify(requestBody)
            });

            // Log the entire server response for troubleshooting
            const rawResponse = await response.text();
            

            // Handle non-successful responses gracefully
            if (!response.ok) {
                if (response.status === 422) {
                    // Log a warning message for "Unprocessable Entity" errors
                    console.warn(`Warning: No performers found for studio ID ${studioId}.`);
                } else {
                    // Log all other types of errors (critical errors)
                    console.error(`Error fetching performers for studio ID ${studioId}: ${response.statusText}`);
                }
                return [];
            }

            const responseData = JSON.parse(rawResponse);
            const performers = responseData?.data?.findPerformers?.performers || [];
            if (performers.length) {
                // Save performers to localStorage
                saveToLocalStorage(studioId, performers);
            }
            return performers;

        } catch (error) {
            // Log critical errors like network failures or unexpected exceptions
            console.error(`Error fetching performers for studio ID ${studioId}:`, error);
            return [];
        }
    };

    // Inject the top performer and queen icon into the studio card
    const injectTopPerformer = async (element) => {
        const studioId = extractStudioId(element);
        if (!studioId) {
            return;
        }

        // Check if the performer info has already been injected into this card
        if (element.querySelector('.top-performer')) {
            return;
        }

        const performers = await fetchPerformers(studioId);
        if (!performers.length) {
            return; // Skip this studio if there are no performers
        }

        // Find the highest scene count and the top performers
        const maxSceneCount = Math.max(...performers.map(p => p.scene_count));
        const topPerformers = performers.filter(p => p.scene_count === maxSceneCount);

        // Create the queen icon and top performer name container
        const topPerformerDiv = document.createElement('div');
        topPerformerDiv.className = 'top-performer';
        topPerformerDiv.style.display = 'flex';
        topPerformerDiv.style.flexDirection = 'column'; // Ensure each performer is on a new line
        topPerformerDiv.style.alignItems = 'center';
        topPerformerDiv.style.justifyContent = 'center';
        topPerformerDiv.style.marginBottom = '10px';

        // Add the queen icon for each top performer with hyperlink
        topPerformers.forEach(performer => {
            // Check if the performer is already listed (to avoid duplicates)
            if (element.querySelector(`a[href$="/performers/${performer.id}/scenes?sortby=date"]`)) {
                return; // Performer is already listed, so skip
            }

            const performerContainer = document.createElement('div');
            performerContainer.style.display = 'flex';
            performerContainer.style.alignItems = 'center';
            performerContainer.style.marginBottom = '5px'; // Add space between performers

            const queenIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            queenIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            queenIcon.setAttribute('viewBox', '0 0 512 512');
            queenIcon.style.width = '20px';
            queenIcon.style.height = '20px';
            queenIcon.style.fill = 'gold';
            queenIcon.innerHTML = `<path d="M256 0a56 56 0 1 1 0 112A56 56 0 1 1 256 0zM134.1 143.8c3.3-13 15-23.8 30.2-23.8c12.3 0 22.6 7.2 27.7 17c12 23.2 36.2 39 64 39s52-15.8 64-39c5.1-9.8 15.4-17 27.7-17c15.3 0 27 10.8 30.2 23.8c7 27.8 32.2 48.3 62.1 48.3c10.8 0 21-2.7 29.8-7.4c8.4-4.4 18.9-4.5 27.6 .9c13 8 17.1 25 9.2 38L399.7 400 384 400l-40.4 0-175.1 0L128 400l-15.7 0L5.4 223.6c-7.9-13-3.8-30 9.2-38c8.7-5.3 19.2-5.3 27.6-.9c8.9 4.7 19 7.4 29.8 7.4c29.9 0 55.1-20.5 62.1-48.3zM256 224s0 0 0 0s0 0 0 0zM112 432l288 0 41.4 41.4c4.2 4.2 6.6 10 6.6 16c0 12.5-10.1 22.6-22.6 22.6L86.6 512C74.1 512 64 501.9 64 489.4c0-6 2.4-11.8 6.6-16L112 432z"/>`;

            const performerNameLink = document.createElement('a');
            performerNameLink.href = `${userConfig.scheme}://${userConfig.host}:${userConfig.port}/performers/${performer.id}/scenes?sortby=date`; // Link to performer's page
            performerNameLink.textContent = performer.name;
            performerNameLink.style.fontWeight = 'bold';
            performerNameLink.style.fontSize = '14px';
            performerNameLink.style.marginLeft = '5px';
            performerNameLink.style.textDecoration = 'none';
            performerNameLink.style.color = 'magenta';

            // Append the queen icon and performer name link to the container
            performerContainer.appendChild(queenIcon);
            performerContainer.appendChild(performerNameLink);

            // Append the container to the top performer div
            topPerformerDiv.appendChild(performerContainer);
        });

        // Inject the top performer div into the top of the studio card
        const cardSection = element.querySelector('.card-section');
        if (cardSection) {
            cardSection.insertAdjacentElement('afterbegin', topPerformerDiv);
        }
    };

    // Extract the studio ID from the studio card
    const extractStudioId = (element) => {
        const link = element.querySelector('.studio-card-header');
        if (link) {
            return new URL(link.href).pathname.split('/').pop();
        }
        return null;
    };

    // Reapply cached performers when navigating back
    const reapplyCachedPerformers = () => {
        const studioCards = document.querySelectorAll('.studio-card');
        studioCards.forEach(studioCard => {
            const studioId = extractStudioId(studioCard);
            const cachedPerformers = loadFromLocalStorage(studioId);
            if (cachedPerformers) {
                injectTopPerformer(studioCard);
            }
        });
    };

    // Observe the page for new studio cards and inject top performer info
    const observer = new MutationObserver(() => {
        const studioCards = document.querySelectorAll('.studio-card');
        studioCards.forEach(studioCard => {
            const studioId = extractStudioId(studioCard);
            if (studioId) {
                injectTopPerformer(studioCard);
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Reapply cached performers on page load
    reapplyCachedPerformers(); 

})();
