// Default configuration for user settings
const defaultConfig = {
    scheme: 'http', // or 'https'
    host: 'localhost', // your server IP or hostname
    port: 9999, // your server port
    apiKey: '', // your API key for the local Stash server
};

// Function to construct the href URL based on user settings
function constructHref() {
    const { scheme, host, port } = defaultConfig;
    return `${scheme}://${host}:${port}/plugin/SceneHub/assets/template/`;
}

// Function to add a custom "Latest Scenes" link to the navbar
function addTestNavLink() {
    // Check if the Test link already exists by looking for the .custom-test-div class
    if (document.querySelector('.custom-test-div')) {
        return;  // Exit the function if it already exists
    }

    // Create a new div to contain the custom "Latest Scenes" link
    const customTestDiv = document.createElement('div');
    customTestDiv.classList.add('col-4', 'col-sm-3', 'col-md-2', 'col-lg-auto', 'nav-link', 'custom-test-div'); // Added custom class for easier checking

    // Create a new link element for the "Latest Scenes" button
    const customTestLink = document.createElement('a');
    customTestLink.href = constructHref(); // Use the dynamically constructed href
    customTestLink.setAttribute('target', '_blank');
    customTestLink.classList.add('minimal', 'p-4', 'p-xl-2', 'd-flex', 'd-xl-inline-block', 'flex-column', 'justify-content-between', 'align-items-center', 'btn', 'btn-primary');

    // Create the SVG icon for refresh
    const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgIcon.setAttribute('viewBox', '0 0 512 512');
    svgIcon.classList.add('svg-inline--fa', 'fa-icon', 'nav-menu-icon', 'd-block', 'd-xl-inline', 'mb-2', 'mb-xl-0');

    const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svgPath.setAttribute('fill', 'Green');
    svgPath.setAttribute('d', 'M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0L386.3 160 352 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l111.5 0c0 0 0 0 0 0l.4 0c17.7 0 32-14.3 32-32l0-112c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 35.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2c-4 4-6.7 8.8-8.1 14c-.3 1.2-.6 2.5-.8 3.8c-.3 1.7-.4 3.4-.4 5.1L16 432c0 17.7 14.3 32 32 32s32-14.3 32-32l0-35.1 17.6 17.5c0 0 0 0 0 0c87.5 87.4 229.3 87.4 316.7 0c24.4-24.4 42.1-53.1 52.9-83.8c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0l-.1-.1L125.6 352l34.4 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L48.4 288c-1.6 0-3.2 .1-4.8 .3s-3.1 .5-4.6 1z');
    svgIcon.appendChild(svgPath);

    // Create the span element for the button text
    const spanText = document.createElement('span');
    spanText.textContent = 'SceneHub';

    // Assemble the button content
    customTestLink.appendChild(svgIcon);
    customTestLink.appendChild(spanText);

    // Insert the link into the custom div
    customTestDiv.appendChild(customTestLink);

    // Find the navbar to insert the custom link (typically the navbar has a class like 'navbar-nav')
    const navbar = document.querySelector('nav .navbar-nav');

    // Insert the custom div into the navbar if it exists
    if (navbar) {
        navbar.appendChild(customTestDiv);
    }
}

// Ensure the button is added only once and persists across page changes
function ensureButtonExists() {
    // If localStorage indicates the button has been created, add it
    if (!document.querySelector('.custom-test-div')) {
        addTestNavLink();
    }
}

// Initial call to add the custom "Latest Scenes" link
if (!localStorage.getItem('testNavLinkCreated')) {
    addTestNavLink();
    localStorage.setItem('testNavLinkCreated', 'true');
} else {
    // Ensure the button is there on page load
    ensureButtonExists();
}

// Listen for page navigation changes to ensure the button reappears
PluginApi.Event.addEventListener("stash:location", () => {
    console.log('Page changed, ensuring the Test link is present...');
    ensureButtonExists();
});
