function ensureMassToggleButton() {
    // Locate the toolbar where the button should be added
    const toolbar = document.querySelector('.filtered-list-toolbar.btn-toolbar');
    if (!toolbar || document.getElementById('mass-toggle-button')) return;

    // Create the "Toggle All Sprites" button
    const button = document.createElement('button');
    button.id = 'mass-toggle-button';
    button.type = 'button';
    button.className = 'btn btn-secondary mb-2'; // Match existing button styling
	button.style.marginLeft = '8px';

    // Add the custom SVG icon to the button
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" class="svg-inline--fa fa-icon" aria-hidden="true" focusable="false" role="img">
            <path fill="currentColor" d="M137.4 502.6c12.5 12.5 32.8 12.5 45.3 0l96-96c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 402.7 192 288l352 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0 0-114.7 41.4 41.4c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-96-96c-12.5-12.5-32.8-12.5-45.3 0l-96 96c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L384 109.3 384 224l-192 0-64 0-96 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0 0 114.7L86.6 361.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l96 96zM128 192l64 0 0-128c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 128zM448 320l-64 0 0 128c0 17.7 14.3 32 32 32s32-14.3 32-32l0-128z"></path>
        </svg>
    `;

    button.title = 'Toggle sprites for all scenes on this page';

    // Append the button to the toolbar
    toolbar.appendChild(button);

    // Add functionality to toggle all sprites
    button.addEventListener('click', () => {
        const sceneCards = document.querySelectorAll('.scene-card');
        sceneCards.forEach((card) => {
            if (card.toggleSprite) {
                card.toggleSprite();
            }
        });
    });
}


// Add toggle sprite functionality to each scene card
function addToggleSpriteLogicToSceneCards() {
    const sceneCards = document.querySelectorAll('.scene-card');
    sceneCards.forEach((card) => {
        const sceneLink = card.querySelector('.scene-card-link'); // The link containing the scene ID
        const previewImage = card.querySelector('img'); // The standard preview image

        if (!sceneLink || !previewImage) return;

        const originalImageSrc = previewImage.src; // Backup the original image source
        let spriteVisible = false;

        card.toggleSprite = async () => {
            const sceneId = extractSceneId(sceneLink.href);
            if (!sceneId) return;

            if (!spriteVisible) {
                const spritePath = await fetchSprite(sceneId);
                if (spritePath) {
                    previewImage.src = spritePath;
                    spriteVisible = true;
                }
            } else {
                previewImage.src = originalImageSrc;
                spriteVisible = false;
            }
        };
    });
}

// Check if the current page is a scenes page or a scenes-related page
function isScenesPage() {
    const path = window.location.pathname;

    // Match the main /scenes page
    if (path.startsWith('/scenes')) return true;

    // Match scenes under studios, performers, or tags
    const validPaths = [
        /^\/studios\/\d+\/scenes/, // /studios/{id}/scenes
        /^\/performers\/\d+\/scenes/, // /performers/{id}/scenes
        /^\/tags\/\d+\/scenes/, // /tags/{id}/scenes
    ];

    return validPaths.some((regex) => regex.test(path));
}


// Extract the scene ID from the URL
function extractSceneId(href) {
    const match = href.match(/\/scenes\/(\d+)/); // Regex to match '/scenes/{id}'
    return match ? match[1] : null;
}

// Fetch sprite path using GraphQL
async function fetchSprite(sceneId) {
    const query = `
        query FindScene($id: ID!) {
            findScene(id: $id) {
                paths {
                    sprite
                }
            }
        }
    `;

    const variables = { id: parseInt(sceneId, 10) }; // Ensure ID is an integer

    try {
        const response = await fetch('/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            console.error('GraphQL response not ok:', response.status, response.statusText);
            return null;
        }

        const result = await response.json();
        console.log('GraphQL result:', result);

        // Validate and extract the sprite path
        const spritePath = result?.data?.findScene?.paths?.sprite;
        if (!spritePath) {
            console.error('No sprite path found in GraphQL response:', result);
            return null;
        }

        return spritePath;
    } catch (error) {
        console.error('Error fetching sprite path:', error);
        return null;
    }
}

// Observe for changes and ensure button and toggle logic addition
function observeScenesPage() {
    const observer = new MutationObserver(() => {
        if (isScenesPage()) {
            ensureMassToggleButton();
            addToggleSpriteLogicToSceneCards();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

// Initial call to add toggle logic and observe for updates
if (isScenesPage()) {
    ensureMassToggleButton();
    addToggleSpriteLogicToSceneCards();
}
observeScenesPage();

// Set up a listener for any stash page change if needed
PluginApi.Event.addEventListener('stash:location', () => {
    console.log('Page changed, ensuring mass toggle button and sprite logic...');
    if (isScenesPage()) {
        ensureMassToggleButton();
        addToggleSpriteLogicToSceneCards();
    }
});
