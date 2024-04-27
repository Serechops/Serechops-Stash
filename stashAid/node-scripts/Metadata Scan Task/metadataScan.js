// Import necessary libraries
const fetch = require('node-fetch');

// Define the GraphQL mutation payload
const mutationPayload = {
    query: `
        mutation MetadataScan {
            metadataScan(
                input: {
                    scanGeneratePreviews: true
                    scanGenerateImagePreviews: true
                    paths: []
                    scanGenerateSprites: true
                    scanGeneratePhashes: true
                    scanGenerateThumbnails: true
                    scanGenerateClipPreviews: true
                }
            )
        }
    `
};

// Function to trigger the metadata scan mutation
async function triggerMetadataScan() {
    try {
        // Send POST request to GraphQL endpoint
        const response = await fetch('http://localhost:9999/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mutationPayload)
        });

        // Parse response as JSON
        const responseData = await response.json();
        console.log('Metadata scan triggered successfully:', responseData);
    } catch (error) {
        console.error('Error triggering metadata scan:', error);
    }
}

// Call the function to trigger the metadata scan
triggerMetadataScan();
