(async function () {
    'use strict';

    console.log("Studio Logo Injector Script started");

    // GraphQL query to fetch studio logo
    const query = `query ($sceneId: ID!) {
        findScene(id: $sceneId) {
            id
            studio {
                id
                image_path
            }
        }
    }`;

    // Async function that returns a promise to fetch the studio logo URL
    const fetchStudioLogo = (sceneId) =>
        fetch(`${userConfig.scheme}://${userConfig.host}:${userConfig.port}/graphql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Apikey ${userConfig.apiKey}`
            },
            body: JSON.stringify({ query, variables: { sceneId } })
        })
        .then(res => res.json()) // Automatically await JSON response
        .then(data => data?.data?.findScene?.studio?.image_path) // Use nullish coalescing operator
        .catch(error => console.error(`Error fetching studio logo for scene ID ${sceneId}:`, error));

    // Extract scene ID from a wall item
    const extractSceneId = (wallItem) => {
        const link = wallItem.querySelector('.wall-item-anchor');
        if (link) {
            return new URL(link.href).pathname.split('/').pop();
        }
        return null;
    };

    // Inject studio logo into the wall item
    const injectStudioLogo = async (element) => {
        const sceneId = extractSceneId(element);
        if (!sceneId) {
            console.warn("No scene ID found for wall item:", element);
            return;
        }

        const logoUrl = await fetchStudioLogo(sceneId);
        if (logoUrl) {
            const logoImg = document.createElement('img');
            logoImg.src = logoUrl;
            logoImg.className = 'studio-overlay';
            element.querySelector('.wall-item-container').appendChild(logoImg);
        } else {
            console.warn(`No studio logo found for scene ID: ${sceneId}`);
        }
    };

    const debouncedInjectLogo = debounce(() => {
        requestAnimationFrame(() => {
            const wallItems = document.querySelectorAll('.wall-item');
            wallItems.forEach(wallItem => {
                if (!wallItem.querySelector('.studio-overlay')) {
                    injectStudioLogo(wallItem);
                }
            });
        });
    }, 200);

    const observer = new MutationObserver(debouncedInjectLogo);
    observer.observe(document.body, { childList: true, subtree: true });

    console.log("Studio Logo Injector Script initialized");

    // Debounce function to limit the rate of function execution
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
})();
