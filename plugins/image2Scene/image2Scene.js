(async () => {
  // Server configuration (users should edit this section as needed)
  const serverConfig = {
    scheme: 'http', // or 'https'
    host: 'localhost',
    port: '9999',
    apiKey: '', // Add your API key here if applicable
  };

  function getApiUrl() {
    let { scheme, host, port } = serverConfig;
    if (host === '0.0.0.0') {
      host = 'localhost';
    }
    return `${scheme}://${host}:${port}/graphql`;
  }

  while (!window.stash) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Dynamically include Awesomplete library and CSS
  const awesompleteCSS = document.createElement('link');
  awesompleteCSS.rel = 'stylesheet';
  awesompleteCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/awesomplete/1.1.5/awesomplete.min.css';
  document.head.appendChild(awesompleteCSS);

  const awesompleteScript = document.createElement('script');
  awesompleteScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/awesomplete/1.1.5/awesomplete.min.js';
  document.head.appendChild(awesompleteScript);

  // Wait for Awesomplete script to load
  await new Promise(resolve => {
    awesompleteScript.onload = resolve;
  });

  // Add custom CSS
  const customCSS = document.createElement('style');
  customCSS.innerHTML = `
    .awesomplete li {
      display: flex;
      align-items: center;
      background: #394b59;
    }

    .awesomplete li img {
      max-width: 100px;
      max-height: 50px;
      margin-right: 5px;
    }

    .awesomplete li span {
      flex: 1;
      color: #fff; /* Adjust text color for better visibility in dark mode */
    }

    #scene-autocomplete.form-control.awesomplete {
      width: 100%;
      background: #394b59; /* Default fill color for the search box */
      color: white; /* Text color inside the search box */
    }

    .autocomplete-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  `;
  document.head.appendChild(customCSS);

  function waitForElement(selector, callback) {
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        callback(element);
      }
    });
    observer.observe(document, {
      childList: true,
      subtree: true
    });
  }

  function createAutoCompleteField(container) {
    // Check if the field already exists
    if (container.querySelector('#scene-autocomplete')) {
      return;
    }

    // Find the Tags dropdown and insert the new field after it
    const tagsDropdown = container.querySelector('.form-group.row label[for="tag_ids"]');
    if (!tagsDropdown) {
      console.error('Tags dropdown not found!');
      return;
    }

    // Create a new form group for the field
    const autoCompleteGroup = document.createElement('div');
    autoCompleteGroup.className = 'form-group row autocomplete-container';

    // Create the label for the field
    const autoCompleteLabel = document.createElement('label');
    autoCompleteLabel.setAttribute('for', 'scene-autocomplete');
    autoCompleteLabel.className = 'form-label col-form-label col-sm-12';
    autoCompleteLabel.innerText = 'Scenes';

    // Create the input element
    const input = document.createElement('input');
    input.id = 'scene-autocomplete';
    input.className = 'form-control awesomplete';
    input.setAttribute('data-list', ''); // Initial empty string

    // Create the "Link Scene" button
    const linkButton = document.createElement('button');
    linkButton.className = 'btn btn-primary';
    linkButton.innerText = 'Link Scene';

    // Append the label, input, and button to the container
    autoCompleteGroup.appendChild(autoCompleteLabel);
    autoCompleteGroup.appendChild(input);
    autoCompleteGroup.appendChild(linkButton);

    // Insert the new field after the Tags dropdown
    tagsDropdown.parentNode.parentNode.insertBefore(autoCompleteGroup, tagsDropdown.parentNode.nextSibling);

    // Initialize Awesomplete
    const awesomplete = new Awesomplete(input, {
      minChars: 1,
      maxItems: 10,
      item: (text, input) => {
        const li = document.createElement('li');
        const img = document.createElement('img');
        const [title, screenshot] = text.split('|');
        img.src = screenshot.trim();
        const div = document.createElement('div');
        div.textContent = title.trim();
        li.appendChild(img);
        li.appendChild(div);
        return li;
      },
      replace: (text) => {
        const [title] = text.split('|');
        input.value = title.trim();
      }
    });

    // Set up event listener to fetch data on input
    input.addEventListener('input', () => fetchScenes(input, awesomplete));

    // Set up event listener for the "Link Scene" button
    linkButton.addEventListener('click', () => handleLinkScene(input, awesomplete));
  }

  async function fetchScenes(input, awesomplete) {
    const query = `
      query AllScenes {
        allScenes {
          id
          title
          paths {
            screenshot
          }
        }
      }
    `;

    try {
      const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serverConfig.apiKey}`
        },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      const scenes = data.data.allScenes;

      // Create a map of scene titles to their IDs and screenshots
      input.sceneMap = scenes.reduce((map, scene) => {
        map[scene.title] = { id: scene.id, screenshot: scene.paths.screenshot };
        return map;
      }, {});

      updateAutoComplete(input, awesomplete, scenes);
    } catch (error) {
      console.error('Error fetching scenes:', error);
    }
  }

  function updateAutoComplete(input, awesomplete, scenes) {
    const list = scenes.map(scene => `${scene.title} | ${scene.paths.screenshot}`);
    awesomplete.list = list;
  }

  async function handleLinkScene(input, awesomplete) {
    const selectedSceneTitle = input.value.trim();
    if (!selectedSceneTitle) {
      console.error('No scene selected');
      return;
    }

    const selectedScene = input.sceneMap[selectedSceneTitle];
    if (!selectedScene) {
      console.error('Selected scene not found');
      return;
    }

    try {
      // Fetch image details
      const imageDetails = await fetchImageDetails();
      if (!imageDetails) {
        console.error('No image details found');
        return;
      }
      const imageName = imageDetails.title;
      const imageId = imageDetails.id;

      // Create gallery
      const galleryId = await createGallery(imageName);

      // Update image to associate with the gallery
      await updateImage(imageId, galleryId);

      // Update scene to associate with the gallery
      await updateScene(selectedScene.id, galleryId);

      console.log('Successfully linked scene to gallery');
    } catch (error) {
      console.error('Error linking scene to gallery:', error);
    }
  }

  function getImageIdFromUrl() {
    const urlParts = window.location.href.split('/');
    return urlParts[urlParts.length - 1];
  }

  async function fetchImageDetails() {
    const imageId = getImageIdFromUrl();
    const query = `
      query FindImage($id: ID!) {
        findImage(id: $id) {
          id
          title
        }
      }
    `;

    const variables = { id: imageId };

    try {
      const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serverConfig.apiKey}`
        },
        body: JSON.stringify({ query, variables }),
      });
      const data = await response.json();
      return data.data.findImage;
    } catch (error) {
      console.error('Error fetching image details:', error);
    }
  }

  async function createGallery(imageName) {
    const mutation = `
      mutation GalleryCreate {
        galleryCreate(input: { title: "${imageName}" }) {
          id
        }
      }
    `;

    try {
      const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serverConfig.apiKey}`
        },
        body: JSON.stringify({ query: mutation }),
      });
      const data = await response.json();
      return data.data.galleryCreate.id;
    } catch (error) {
      console.error('Error creating gallery:', error);
    }
  }

  async function updateImage(imageId, galleryId) {
    const mutation = `
      mutation ImageUpdate {
        imageUpdate(input: { id: "${imageId}", gallery_ids: ["${galleryId}"] }) {
          id
        }
      }
    `;

    try {
      const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serverConfig.apiKey}`
        },
        body: JSON.stringify({ query: mutation }),
      });
      const data = await response.json();
      return data.data.imageUpdate.id;
    } catch (error) {
      console.error('Error updating image:', error);
    }
  }

  async function updateScene(sceneId, galleryId) {
    const mutation = `
      mutation SceneUpdate {
        sceneUpdate(input: { id: "${sceneId}", gallery_ids: ["${galleryId}"] }) {
          id
        }
      }
    `;

    try {
      const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serverConfig.apiKey}`
        },
        body: JSON.stringify({ query: mutation }),
      });
      const data = await response.json();
      return data.data.sceneUpdate.id;
    } catch (error) {
      console.error('Error updating scene:', error);
    }
  }

  function setupElementObserver() {
    waitForElement('#image-edit-details', (element) => {
      createAutoCompleteField(element);
    });
  }

  setupElementObserver();

  PluginApi.Event.addEventListener('stash:location', () => {
    console.log('Page changed, re-checking for elements...');
    setupElementObserver();
  });
})();
