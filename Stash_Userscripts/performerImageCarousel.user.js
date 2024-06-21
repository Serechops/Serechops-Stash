// ==UserScript==
// @name         Performer Image Carousel
// @namespace    https://github.com/Serechops/Serechops-Stash
// @version      1.1
// @description  Displays a carousel of performer images in the header.
// @match        http://localhost:9999/performers/*/scenes?sortby=date
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @connect      stashdb.org
// @downloadURL  https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/performerImageCarousel.user.js
// @updateURL  https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/performerImageCarousel.user.js
// @run-at       document-end
// ==/UserScript==

(async function() {
    'use strict';

    /******************************************
     * USER CONFIGURATION
     ******************************************/
    const userConfig = {
        scheme: 'http', // or 'https'
        host: 'localhost', // your server IP or hostname
        port: 9999, // your server port
        apiKey: '', // your API key for local Stash server
        stashDBApiKey: '' // your API key for StashDB
    };

    // Build API URL
    const apiUrl = `${userConfig.scheme}://${userConfig.host}:${userConfig.port}/graphql`;

    // Server and API key configuration
    const config = {
        serverUrl: apiUrl,
        apiKey: userConfig.apiKey,
        stashDBApiKey: userConfig.stashDBApiKey
    };

    // Inject CSS for the carousel
    const style = document.createElement('style');
    style.innerHTML = `
        .performer-carousel-img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0;
            transition: opacity 2s ease-in-out, transform 2s ease-in-out;
            transform: scale(1.05);
        }
        .performer-carousel-img.active {
            opacity: 1;
            transform: scale(1);
        }
    `;
    document.head.appendChild(style);

    // Function to fetch performer ID from the URL
    function getPerformerID() {
        const urlParts = window.location.pathname.split('/');
        return urlParts[2]; // Assuming the performer ID is the third segment of the path
    }

    // Function to fetch performer images from StashDB
    async function fetchPerformerImagesFromStashDB(performerStashID) {
        const query = `
            query FindPerformer($id: ID!) {
                findPerformer(id: $id) {
                    images {
                        url
                        width
                        height
                    }
                }
            }
        `;
        try {
            const response = await gqlQuery('https://stashdb.org/graphql', query, { id: performerStashID }, config.stashDBApiKey);
            if (response && response.data && response.data.findPerformer) {
                return response.data.findPerformer.images;
            } else {
                console.error('No images found for performer in StashDB:', performerStashID);
                return [];
            }
        } catch (error) {
            console.error('Error fetching performer images from StashDB:', error);
            return [];
        }
    }

    // Function to fetch performer images from local server
    async function fetchPerformerImagesFromLocal(performerID) {
        const query = `
            query FindLooseImages($performer_id: [ID!]!) {
                findImages(
                    image_filter: { performers: { value: $performer_id, modifier: INCLUDES } }
                    filter: { per_page: -1 }
                ) {
                    images {
                        id
                        files {
                            width
                            height
                        }
                        paths {
                            thumbnail
                        }
                    }
                }
            }
        `;
        try {
            const response = await graphqlRequest(query, { performer_id: [performerID] }, config.apiKey);
            if (response && response.data && response.data.findImages) {
                return response.data.findImages.images;
            } else {
                console.error('No images found for performer in local gallery:', performerID);
                return [];
            }
        } catch (error) {
            console.error('Error fetching performer images from local:', error);
            return [];
        }
    }

    // Function to fetch performer's StashDB ID
    async function fetchPerformerStashDBID(performerID) {
        const query = `
            query FindPerformer($id: ID!) {
                findPerformer(id: $id) {
                    stash_ids {
                        stash_id
                    }
                }
            }
        `;
        try {
            const response = await graphqlRequest(query, { id: performerID }, config.apiKey);
            if (response && response.data && response.data.findPerformer) {
                return response.data.findPerformer.stash_ids.map(id => id.stash_id);
            } else {
                console.error('No stash_ids found for performer:', performerID);
                return null;
            }
        } catch (error) {
            console.error('Error fetching performer StashDB ID:', error);
            return null;
        }
    }

    // Function to make GraphQL request
    async function graphqlRequest(query, variables = {}, apiKey = '') {
        const response = await fetch(config.serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Apikey': apiKey
            },
            body: JSON.stringify({ query, variables })
        });
        return response.json();
    }

    // Function to make GraphQL request using GM.xmlHttpRequest
    async function gqlQuery(endpoint, query, variables = {}, apiKey = '') {
        return new Promise((resolve, reject) => {
            GM.xmlHttpRequest({
                method: 'POST',
                url: endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'Apikey': apiKey
                },
                data: JSON.stringify({ query, variables }),
                onload: function(response) {
                    resolve(JSON.parse(response.responseText));
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Function to start the carousel
    async function startCarousel(images) {
        const headerImageContainer = document.querySelector('.detail-header-image img.performer');
        if (!headerImageContainer) {
            console.error('No header image container found.');
            return;
        }

        let currentIndex = 0;
        const interval = setInterval(() => {
            const nextImageUrl = images[currentIndex].url;
            const newImage = new Image();
            newImage.src = nextImageUrl;
            newImage.classList.add('performer-carousel-img');
            newImage.onload = () => {
                headerImageContainer.src = nextImageUrl;
            };
            currentIndex = (currentIndex + 1) % images.length;
        }, 3000); // Change image every 3 seconds

        return interval;
    }

    async function initCarousel() {
        const performerID = getPerformerID();
        const localImages = await fetchPerformerImagesFromLocal(performerID);
        if (localImages.length > 0) {
            activeCarouselInterval = await startCarousel(localImages.map(img => ({ url: img.paths.thumbnail })));
        } else {
            const stashIDs = await fetchPerformerStashDBID(performerID);
            if (stashIDs && stashIDs.length > 0) {
                const stashDBImages = await fetchPerformerImagesFromStashDB(stashIDs[0]);
                activeCarouselInterval = await startCarousel(stashDBImages);
            }
        }
    }

    // Function to check if the current URL matches the desired pattern
    function checkURL() {
        const urlPattern = /\/performers\/\d+\/scenes\?sortby=date/;
        return urlPattern.test(window.location.pathname + window.location.search);
    }

    // Variable to store the active carousel interval
    let activeCarouselInterval = null;

    // Interval to check the URL periodically
    setInterval(() => {
        if (checkURL() && !activeCarouselInterval) {
            initCarousel();
        } else if (!checkURL() && activeCarouselInterval) {
            clearInterval(activeCarouselInterval);
            activeCarouselInterval = null;
        }
    }, 3000); // Check every 3 seconds

})();
