(async function () {
  'use strict';

  // Prevent multiple initializations if the script is included more than once
  if (window.performerFaviconsScriptLoaded) {
    console.log('Performer Favicons Script is already loaded');
    return;
  }
  window.performerFaviconsScriptLoaded = true;

  console.log('Performer Favicons Script started');

  // GraphQL Setup
  const gqlEndpoint = localStorage.getItem('apiEndpoint') || '/graphql';
  const apiKey = localStorage.getItem('apiKey') || null;
  const gqlHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    return headers;
  };

  // Extract performer ID from the URL
  const getPerformerId = () => {
    const path = window.location.pathname;
    const match = path.match(/\/performers\/(\d+)\//);
    return match ? match[1] : null;
  };

  // Fetch performer URLs from GraphQL (Reverted Local Query)
  const fetchPerformerUrls = async (performerId) => {
    const query = `
      query FindPerformer($id: ID!) {
        findPerformer(id: $id) {
          urls
        }
      }
    `;
    const variables = { id: performerId };

    console.log('Sending GraphQL request:', {
      query,
      variables,
    });

    try {
      const response = await fetch(gqlEndpoint, {
        method: 'POST',
        headers: gqlHeaders(),
        body: JSON.stringify({ query, variables }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('GraphQL request failed:', {
          status: response.status,
          statusText: response.statusText,
          response: data,
        });
      } else {
        console.log('GraphQL response received:', data);
      }

      return data?.data?.findPerformer?.urls || [];
    } catch (error) {
      console.error('Error during GraphQL request:', error);
      return [];
    }
  };

  // Create favicon elements
  const createFaviconContainer = (urls) => {
    const container = document.createElement('div');
    container.className = 'performer-favicons-container';
    container.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
      justify-content: center;
    `;

    urls.forEach((url) => {
      const domain = new URL(url).hostname;

      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.cssText = `
        display: inline-block;
        width: 24px;
        height: 24px;
        background-color: none;
        border-radius: 4px;
        overflow: hidden;
      `;

      const img = document.createElement('img');
      img.onerror = function () {
        // Fallback logic for missing favicon
      };
      img.src = `https://www.google.com/s2/favicons?sz=64&domain_url=${domain}`;
      img.alt = domain;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      link.appendChild(img);
      container.appendChild(link);
    });

    return container;
  };

  let lastProcessedPerformerId = null;
  let faviconsVisibleForCurrentPerformer = false;
  let isAddingFavicons = false; // concurrency guard

  // Add favicons to the page
  const addFaviconsToPage = async () => {
    const performerId = getPerformerId();
    if (!performerId) return;

    if (
      performerId === lastProcessedPerformerId &&
      faviconsVisibleForCurrentPerformer
    ) {
      return;
    }

    if (isAddingFavicons) {
      return;
    }

    const detailGroup = document.querySelector('.detail-group');
    if (!detailGroup) return;

    const existingContainer = document.querySelector(
      '.performer-favicons-container'
    );
    if (existingContainer) {
      faviconsVisibleForCurrentPerformer = true;
      lastProcessedPerformerId = performerId;
      return;
    }

    isAddingFavicons = true;

    const urls = await fetchPerformerUrls(performerId);
    if (urls.length === 0) {
      console.log('No URLs found for this performer.');
      isAddingFavicons = false;
      return;
    }

    const faviconContainer = createFaviconContainer(urls);
    detailGroup.appendChild(faviconContainer); // Append the container as the last item

    lastProcessedPerformerId = performerId;
    faviconsVisibleForCurrentPerformer = true;
    isAddingFavicons = false; // Release concurrency guard
    console.log('Favicons added to performer page for performer:', performerId);
  };

  // Continuously observe the DOM for .detail-container and re-run when needed
  const observer = new MutationObserver(() => {
    const currentPerformerId = getPerformerId();
    if (window.location.pathname.includes('/performers/')) {
      if (
        currentPerformerId &&
        currentPerformerId !== lastProcessedPerformerId
      ) {
        faviconsVisibleForCurrentPerformer = false;
      }
      const container = document.querySelector('.detail-container');
      if (container) {
        addFaviconsToPage();
      }
    } else {
      lastProcessedPerformerId = null;
      faviconsVisibleForCurrentPerformer = false;
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
