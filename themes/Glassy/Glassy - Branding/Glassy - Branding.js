// Function to customize the Donate button
function customizeDonateButton() {
    // Find the original donate button link
    const originalDonateLink = document.querySelector('a.nav-utility.nav-link[href="https://opencollective.com/stashapp"]');

    if (originalDonateLink) {
        // Hide the original donate button
        originalDonateLink.style.display = 'none';

        // Create a new div to contain the custom support button
        const customSupportDiv = document.createElement('div');
        customSupportDiv.classList.add('nav-utility', 'custom-support-div');

        // Apply CSS to position the custom div at the top right of the screen
        customSupportDiv.style.position = 'fixed';
        customSupportDiv.style.top = '4px'; 
        customSupportDiv.style.right = '225px'; 
        customSupportDiv.style.zIndex = '10000'; 

        // Create a new link element for the custom support button
        const customDonateLink = document.createElement('a');
        customDonateLink.href = 'https://www.patreon.com/serechops/membership';
        customDonateLink.setAttribute('target', '_blank');
        customDonateLink.classList.add('nav-utility', 'nav-link');

        // Create a new button inside the link
        const customDonateButton = document.createElement('button');
        customDonateButton.title = 'Support';
        customDonateButton.type = 'button';
        customDonateButton.classList.add('minimal', 'support', 'btn', 'btn-primary');

        // Change the text color to yellow
        customDonateButton.style.color = 'yellow';

        // Create the span element for the button text
        const spanText = document.createElement('span');
        spanText.classList.add('d-none', 'd-sm-inline');
        spanText.textContent = 'Support';

        // Add the Patreon icon
        const patreonIcon = document.createElement('img');
        patreonIcon.src = '/plugin/Glassy - Branding/assets/patreon.png';
        patreonIcon.alt = 'Patreon';
        patreonIcon.style.width = '20px';
        patreonIcon.style.height = '20px';
        patreonIcon.style.verticalAlign = 'middle';
        patreonIcon.style.marginRight = '5px';
        patreonIcon.style.filter = 'invert';

        // Assemble the button content
        customDonateButton.appendChild(patreonIcon);
        customDonateButton.appendChild(spanText);

        // Insert the button into the link
        customDonateLink.appendChild(customDonateButton);

        // Insert the link into the custom div
        customSupportDiv.appendChild(customDonateLink);

        // Insert the custom div into the document body to ensure it populates correctly
        document.body.appendChild(customSupportDiv);
    }
}

// Initial call to customize the Donate button
customizeDonateButton();

// Set up a listener for any stash page change if needed
PluginApi.Event.addEventListener("stash:location", () => {
    console.log('Page changed, customizing the Donate button again...');
    customizeDonateButton();
});
