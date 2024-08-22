(async function () {
    'use strict';

    console.log("FPS Injector Script started");

    // Define the GraphQL endpoint
    const graphqlEndpoint = '/graphql';

    // GraphQL query to fetch FPS
    const query = `query ($sceneId: ID!) {
        findScene(id: $sceneId) {
            id
            files { frame_rate }
        }
    }`;

    // Async function to fetch FPS for a scene
    const fetchFPS = (sceneId) =>
        fetch(graphqlEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables: { sceneId } })
        })
        .then(res => res.json())
        .then(data => data?.data?.findScene?.files?.[0]?.frame_rate)
        .then(fps => fps ? Math.round(fps) : null)
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
            fpsSpan.textContent = ` ${fps}`;
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
