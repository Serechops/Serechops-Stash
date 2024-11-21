function ensureMassToggleButton() {
    // Locate the toolbar where the button should be added
    const toolbar = document.querySelector('.filtered-list-toolbar.btn-toolbar');
    if (!toolbar || document.getElementById('mass-toggle-button')) return;

    // Create the "Toggle All Sprites" button
    const button = document.createElement('button');
    button.id = 'mass-toggle-button';
    button.innerText = 'Toggle Sprites';
    button.title = 'Toggle sprites for all scenes on this page';
    button.type = 'button';
    button.className = 'btn btn-secondary ml-2'; // Match existing button styling

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
