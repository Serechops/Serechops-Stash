/******************************************
 * USER CONFIGURATION
 ******************************************/
const userConfig = {
    scheme: 'http', // or 'https'
    host: 'localhost', // your server IP or hostname
    port: 9999, // your server port
    apiKey: '' // your API key, if needed
};

(async function () {
    'use strict';

    console.log("FPS Injector Script started");

    // Move query to be a constant and use GQL variables
    const query = `query ($sceneId: ID!) {
        findScene(id: $sceneId) {
            id
            files { frame_rate }
        }
    }`;

    // Async function that returns a promise to fetch FPS
    const fetchFPS = (sceneId) =>
        fetch(`${userConfig.scheme}://${userConfig.host}:${userConfig.port}/graphql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Apikey ${userConfig.apiKey}`
            },
            body: JSON.stringify({ query, variables: { sceneId } })
        })
        .then(res => res.json()) // Automatically await JSON response
        .then(data => data?.data?.findScene?.files?.[0]?.frame_rate) // Use nullish coalescing operator
        .then(fps => fps ? Math.round(fps) : null) // Round FPS to the nearest whole number
        .catch(error => console.error(`Error fetching FPS for scene ID ${sceneId}:`, error));

    // Extract scene ID from a scene card
    const extractSceneId = (sceneCard) => {
        const link = sceneCard.querySelector('.scene-card-link');
        if (link) {
            return new URL(link.href).pathname.split('/').pop();
        }
        return null;
    };

    // Inject FPS value into the scene card
    const injectFPS = async (element) => {
        const resolutionOverlay = element.querySelector('span.overlay-resolution');
        if (!resolutionOverlay) {
            return;
        }

        const sceneId = extractSceneId(element);
        if (!sceneId) {
            console.warn("No scene ID found for card:", element);
            return;
        }

        const fps = await fetchFPS(sceneId);
        if (fps) {
            const fpsSpan = document.createElement('span');
            fpsSpan.className = 'overlay-fps';
            fpsSpan.textContent = ` ${fps} FPS`;
            resolutionOverlay.appendChild(fpsSpan);
        } else {
            console.warn(`No FPS found for scene ID: ${sceneId}`);
        }
    };

    const debouncedInjectFPS = debounce(() => {
        requestAnimationFrame(() => {
            const sceneCards = document.querySelectorAll('.scene-card');
            sceneCards.forEach(sceneCard => {
                if (!sceneCard.querySelector('.overlay-fps')) {
                    injectFPS(sceneCard);
                }
            });
        });
    }, 200);

    const observer = new MutationObserver(debouncedInjectFPS);
    observer.observe(document.body, { childList: true, subtree: true });

    console.log("FPS Injector Script initialized");

    // Debounce function to limit the rate of function execution
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
})();
