// Custom Resolution Icons in Scene Card

const resolutionMap = {
    '360p': '/plugin/Glassy - Video-Res Icons/assets/icons/360.png',
    '480p': '/plugin/Glassy - Video-Res Icons/assets/icons/480.png',
    '720p': '/plugin/Glassy - Video-Res Icons/assets/icons/720.png',
    '1080p': '/plugin/Glassy - Video-Res Icons/assets/icons/1080.png',
    '1440p': '/plugin/Glassy - Video-Res Icons/assets/icons/1440.png',
    '4K': '/plugin/Glassy - Video-Res Icons/assets/icons/4k.png',
    '5K': '/plugin/Glassy - Video-Res Icons/assets/icons/5k.png',
    '6K': '/plugin/Glassy - Video-Res Icons/assets/icons/6k.png',
    '8K': '/plugin/Glassy - Video-Res Icons/assets/icons/8k.png',
    '16K': '/plugin/Glassy - Video-Res Icons/assets/icons/16k.png'
};

function setupElementObserver() {
    waitForElement('.scene-card', (element) => {
        // Check if an icon is already added to prevent duplicates
        if (element.querySelector('.resolution-icon')) {
            return;
        }

        const overlays = element.querySelectorAll('span.overlay-resolution');
        overlays.forEach(overlay => {
            const resolution = overlay.textContent.trim();
            if (resolutionMap[resolution]) {
                // Create an image element for the icon
                const img = document.createElement('img');
                img.src = resolutionMap[resolution]; // Link to the image from the map
                img.alt = resolution;
                img.classList.add('resolution-icon'); // Add a class for easy identification

                // Apply CSS styles to position the image in the top left corner
                img.style.position = 'absolute';
                img.style.top = '5px'; // Slightly offset from the top edge
                img.style.left = '5px'; // Slightly offset from the left edge
                img.style.zIndex = '10'; // Ensure it's on top of other elements
                
                // Adjust the size based on the card dimensions
                const iconSize = Math.min(element.offsetWidth, element.offsetHeight) * 0.15; // Icon width is 15% of the smaller dimension
                const iconHeight = iconSize * 0.6; // Adjust height to 60% of the width for a widescreen aspect ratio
                img.style.width = `${iconSize}px`;
                img.style.height = `${iconHeight}px`;

                // Append the image to the scene card
                element.appendChild(img);
            }
        });
    });
}

// Initial call to handle elements on the current page
setupElementObserver();

// Set up a listener for any stash page change
PluginApi.Event.addEventListener("stash:location", () => {
    console.log('Page changed, re-checking for elements...');
    setupElementObserver();
});

// Modified waitForElement function
function waitForElement(selector, callback) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.matches(selector)) {
                    callback(node);
                }
                // If the node has children, recursively check each child node that matches the selector
                node.querySelectorAll && node.querySelectorAll(selector).forEach(callback);
            });
        });
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
