(async function () {
  'use strict';

  console.log('Tag Colorization Script started');

  // ---------------------------------------------------------------------------
  // 1. Storage Objects
  // ---------------------------------------------------------------------------

  // ----- Regular Tag Data -----
  const storedTagColors = JSON.parse(localStorage.getItem('tagColors')) || {};
  const storedRegexTemplates = JSON.parse(
    localStorage.getItem('regexTemplates')
  ) || [
    { pattern: '^Important$', cssTemplateName: 'ImportantTag' },
    { pattern: '^Todo$', cssTemplateName: 'TodoTag' },
  ];

  // ----- Single CSS Templates object (shared) -----
  const storedCssTemplates = JSON.parse(
    localStorage.getItem('cssTemplates')
  ) || {
    ImportantTag: {
      backgroundColor: '#FF0000',
      color: '#FFFFFF',
      borderRadius: '5px',
      padding: '2px 6px',
    },
    TodoTag: {
      backgroundColor: '#FFA500',
      color: '#000000',
      borderRadius: '5px',
      padding: '2px 6px',
    },
  };

  // ----- Sort Name Data -----
  const storedSortNameColors =
    JSON.parse(localStorage.getItem('sortNameColors')) || {};
  const storedSortNameRegexTemplates =
    JSON.parse(localStorage.getItem('sortNameRegexTemplates')) || [];

  // ----- Parent Tag Data (Manual) -----
  const storedParentTagColors =
    JSON.parse(localStorage.getItem('parentTagColors')) || {};
  const storedParentRegexTemplates =
    JSON.parse(localStorage.getItem('parentRegexTemplates')) || [];
  // Instead of a separate parentCssTemplates, we’ll just use storedCssTemplates above.

  // Mapping of parent ID -> { name, children[] }
  const storedParentMapping =
    JSON.parse(localStorage.getItem('parentMapping')) || {};

  // Parent Group Styles from DB groupings (color or template name)
  // Key: parentId -> { color?: string, cssTemplateName?: string }
  const storedParentGroupStyles =
    JSON.parse(localStorage.getItem('parentGroupStyles')) || {};

  // ---------------------------------------------------------------------------
  // 2. Save Functions
  // ---------------------------------------------------------------------------
  const saveTagColors = () => {
    localStorage.setItem('tagColors', JSON.stringify(storedTagColors));
    console.log('Tag colors saved:', storedTagColors);
  };
  const saveRegexTemplates = () => {
    localStorage.setItem(
      'regexTemplates',
      JSON.stringify(storedRegexTemplates)
    );
    console.log('Regex templates saved:', storedRegexTemplates);
  };
  const saveCssTemplates = () => {
    localStorage.setItem('cssTemplates', JSON.stringify(storedCssTemplates));
    console.log('CSS templates saved:', storedCssTemplates);
  };
  const saveSortNameColors = () => {
    localStorage.setItem(
      'sortNameColors',
      JSON.stringify(storedSortNameColors)
    );
    console.log('Sort Name colors saved:', storedSortNameColors);
  };
  const saveSortNameRegexTemplates = () => {
    localStorage.setItem(
      'sortNameRegexTemplates',
      JSON.stringify(storedSortNameRegexTemplates)
    );
    console.log(
      'Sort Name regex templates saved:',
      storedSortNameRegexTemplates
    );
  };
  const saveParentTagColors = () => {
    localStorage.setItem(
      'parentTagColors',
      JSON.stringify(storedParentTagColors)
    );
    console.log('Parent tag colors saved:', storedParentTagColors);
  };
  const saveParentRegexTemplates = () => {
    localStorage.setItem(
      'parentRegexTemplates',
      JSON.stringify(storedParentRegexTemplates)
    );
    console.log('Parent regex templates saved:', storedParentRegexTemplates);
  };
  const saveParentMapping = () => {
    localStorage.setItem('parentMapping', JSON.stringify(storedParentMapping));
    console.log('Parent mapping saved:', storedParentMapping);
  };
  const saveParentGroupStyles = () => {
    localStorage.setItem(
      'parentGroupStyles',
      JSON.stringify(storedParentGroupStyles)
    );
    console.log('Parent group styles saved:', storedParentGroupStyles);
  };

  // ---------------------------------------------------------------------------
  // 3. GraphQL Query Functions
  // ---------------------------------------------------------------------------
  const gqlEndpoint = '/graphql';
  const apiKey = localStorage.getItem('apiKey') || null;
  const gqlHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return headers;
  };

  // Query for Regular Tags by name (for suggestions)
  const queryTags = async (tagName) => {
    const query = `
      query FindTags($filter: FindFilterType, $tag_filter: TagFilterType) {
        findTags(filter: $filter, tag_filter: $tag_filter) {
          tags {
            id
            name
          }
        }
      }
    `;
    const variables = {
      filter: { per_page: -1 },
      tag_filter: { name: { value: tagName, modifier: 'INCLUDES' } },
    };
    try {
      const response = await fetch(gqlEndpoint, {
        method: 'POST',
        headers: gqlHeaders(),
        body: JSON.stringify({ query, variables }),
      });
      const data = await response.json();
      return data?.data?.findTags?.tags || [];
    } catch (error) {
      console.error('Error querying tags:', error);
      return [];
    }
  };

  // Fetch all parent-child groupings
  const fetchParentChildGroupings = async () => {
    const query = `
      query FindTags($filter: FindFilterType, $tag_filter: TagFilterType) {
        findTags(filter: $filter, tag_filter: $tag_filter) {
          tags {
            id
            name
            sort_name
            children {
              id
              name
              sort_name
            }
          }
        }
      }
    `;
    const variables = {
      filter: { per_page: -1, sort: 'name', direction: 'ASC' },
      tag_filter: { children: { modifier: 'NOT_NULL' } },
    };
    try {
      const response = await fetch(gqlEndpoint, {
        method: 'POST',
        headers: gqlHeaders(),
        body: JSON.stringify({ query, variables }),
      });
      const data = await response.json();
      return data?.data?.findTags?.tags || [];
    } catch (error) {
      console.error('Error fetching parent-child groupings:', error);
      return [];
    }
  };

  // Fetch all tags with a non-null sort_name
  const fetchSortNames = async () => {
    const query = `
      query FindTags {
        findTags(
          tag_filter: { sort_name: { modifier: NOT_NULL, value: "[]" } }
          filter: { per_page: -1, sort: "name", direction: ASC }
        ) {
          tags {
            id
            name
            sort_name
            parents {
              id
              name
              sort_name
            }
            children {
              id
              name
              sort_name
            }
          }
        }
      }
    `;
    try {
      const response = await fetch(gqlEndpoint, {
        method: 'POST',
        headers: gqlHeaders(),
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      return data?.data?.findTags?.tags || [];
    } catch (error) {
      console.error('Error fetching sort names:', error);
      return [];
    }
  };

  // Cache for fetched parent groups
  let fetchedParentGroups = [];
  fetchParentChildGroupings().then((groups) => {
    fetchedParentGroups = groups;
  });

  // ---------------------------------------------------------------------------
  // 4. Helper Functions
  // ---------------------------------------------------------------------------
  const applyCSS = (element, styles, verticalLine, svg) => {
    Object.entries(styles).forEach(([key, value]) => {
      element.style[key] = value;
    });
    if (verticalLine) verticalLine.style.color = styles.color || '#FFFFFF';
    if (svg) svg.style.color = styles.color || '#FFFFFF';
  };

  const getSortName = (displayName) => {
    for (const group of fetchedParentGroups) {
      if (group.name === displayName && group.sort_name) {
        return group.sort_name;
      }
      for (const child of group.children) {
        if (child.name === displayName && child.sort_name) {
          return child.sort_name;
        }
      }
    }
    return null;
  };

  // ---------------------------------------------------------------------------
  // 5. Apply Tag Styles (Refactored & Unified)
  // ---------------------------------------------------------------------------
  // Priority order:
  // 1) Sort Name
  // 2) Parent Tag
  // 3) Regular Tag
  // Within each category, direct color overrides regex pattern.

  const applyTagStyles = (tagElement) => {
    const div = tagElement.querySelector('a > div') ?? false;
    const displayName = div
      ? div.childNodes[0].textContent.trim()
      : tagElement.innerText.trim();
    const sortName = getSortName(displayName);

    // For the little vertical line or icon in the tag
    const verticalLine = tagElement.querySelector('span > span') ?? false;
    const svg = tagElement.querySelector('path') ?? false;

    // --------------------------------
    // 1. Sort Name styling
    // --------------------------------
    if (sortName) {
      // 1a. Direct color
      if (storedSortNameColors[sortName]) {
        // Possibly a direct color or a mapped template
        if (
          storedSortNameColors._cssTemplates &&
          storedSortNameColors._cssTemplates[sortName]
        ) {
          const tplName = storedSortNameColors._cssTemplates[sortName];
          if (storedCssTemplates[tplName]) {
            return applyCSS(
              tagElement,
              storedCssTemplates[tplName],
              verticalLine,
              svg
            );
          }
        }
        // Otherwise just color
        return applyCSS(
          tagElement,
          {
            backgroundColor: storedSortNameColors[sortName],
            color: '#FFFFFF',
            borderRadius: '5px',
            padding: '2px 6px',
          },
          verticalLine,
          svg
        );
      }
      // 1b. Regex pattern
      for (let template of storedSortNameRegexTemplates) {
        let regex;
        try {
          regex = new RegExp(template.pattern, 'i');
        } catch (e) {
          console.error(`Invalid sort_name regex pattern: ${template.pattern}`);
          continue;
        }
        if (regex.test(sortName)) {
          const cssTemplate = storedCssTemplates[template.cssTemplateName];
          if (cssTemplate) {
            return applyCSS(tagElement, cssTemplate, verticalLine, svg);
          }
        }
      }
    }

    // --------------------------------
    // 2. Parent Tag styling
    // --------------------------------
    // 2a. Check known DB group styles
    for (const parentId in storedParentGroupStyles) {
      const groupStyle = storedParentGroupStyles[parentId];
      const group = fetchedParentGroups.find((g) => g.id === parentId);
      if (group) {
        const groupNames = [group.name, ...group.children.map((c) => c.name)];
        if (groupNames.includes(displayName)) {
          // color or template
          if (
            groupStyle.cssTemplateName &&
            storedCssTemplates[groupStyle.cssTemplateName]
          ) {
            return applyCSS(
              tagElement,
              storedCssTemplates[groupStyle.cssTemplateName],
              verticalLine,
              svg
            );
          } else if (groupStyle.color) {
            return applyCSS(
              tagElement,
              {
                backgroundColor: groupStyle.color,
                color: '#FFFFFF',
                borderRadius: '5px',
                padding: '2px 6px',
              },
              verticalLine,
              svg
            );
          }
        }
      }
    }

    // 2b. Manual parent mapping (if .parent-tag class)
    if (tagElement.classList.contains('parent-tag')) {
      const parentId = Object.keys(storedParentMapping).find(
        (pid) => storedParentMapping[pid].name === displayName
      );
      if (parentId && storedParentTagColors[parentId]) {
        // Possibly a direct color or a template
        if (
          storedParentTagColors._cssTemplates &&
          storedParentTagColors._cssTemplates[parentId]
        ) {
          const tplName = storedParentTagColors._cssTemplates[parentId];
          if (storedCssTemplates[tplName]) {
            return applyCSS(
              tagElement,
              storedCssTemplates[tplName],
              verticalLine,
              svg
            );
          }
        }
        // Otherwise color
        return applyCSS(
          tagElement,
          {
            backgroundColor: storedParentTagColors[parentId],
            color: '#FFFFFF',
            borderRadius: '5px',
            padding: '2px 6px',
          },
          verticalLine,
          svg
        );
      }
      // Parent Regex
      for (let template of storedParentRegexTemplates) {
        let regex;
        try {
          regex = new RegExp(template.pattern, 'i');
        } catch (e) {
          console.error(`Invalid parent regex pattern: ${template.pattern}`);
          continue;
        }
        if (regex.test(displayName)) {
          const cssTemplate = storedCssTemplates[template.cssTemplateName];
          if (cssTemplate) {
            return applyCSS(tagElement, cssTemplate, verticalLine, svg);
          }
        }
      }
    }

    // --------------------------------
    // 3. Regular Tag styling
    // --------------------------------
    // 3a. Direct color or template
    if (storedTagColors[displayName]) {
      if (
        storedTagColors._cssTemplates &&
        storedTagColors._cssTemplates[displayName]
      ) {
        const tplName = storedTagColors._cssTemplates[displayName];
        if (storedCssTemplates[tplName]) {
          return applyCSS(
            tagElement,
            storedCssTemplates[tplName],
            verticalLine,
            svg
          );
        }
      }
      // Otherwise color
      return applyCSS(
        tagElement,
        {
          backgroundColor: storedTagColors[displayName],
          color: '#FFFFFF',
          borderRadius: '5px',
          padding: '2px 6px',
        },
        verticalLine,
        svg
      );
    }

    // 3b. Regex
    for (let template of storedRegexTemplates) {
      let regex;
      try {
        regex = new RegExp(template.pattern, 'i');
      } catch (e) {
        console.error(`Invalid regex pattern: ${template.pattern}`);
        continue;
      }
      if (regex.test(displayName)) {
        const cssTemplate = storedCssTemplates[template.cssTemplateName];
        if (cssTemplate) {
          return applyCSS(tagElement, cssTemplate, verticalLine, svg);
        }
      }
    }
  };

  // Colorize all matched tags on the page
  const colorizeTags = () => {
    requestAnimationFrame(() => {
      document
        .querySelectorAll(
          '.react-select__multi-value__label, .tag-item, .wall-tag, .parent-tag'
        )
        .forEach((tag) => applyTagStyles(tag));
    });
  };
  const debouncedColorizeTags = debounce(colorizeTags, 200);

  // Observe DOM changes to recolor tags dynamically
  const observer = new MutationObserver(debouncedColorizeTags);
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('Tag Colorization Script initialized');

  // ---------------------------------------------------------------------------
  // 6. Debounce Helper
  // ---------------------------------------------------------------------------
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // ---------------------------------------------------------------------------
  // 7. UI Creation Functions (Reusable)
  // ---------------------------------------------------------------------------

  /**
   * Creates a row to manage direct color vs. CSS Template for a given key (tag name, parent ID, or sort name).
   * @param {Object} options
   * @param {string} options.objKey - The object key (tag name, parent ID, or sort_name).
   * @param {string} options.displayText - The user-facing text to display.
   * @param {string} options.initColor - Initial color.
   * @param {Object} options.storageObj - The storage object (e.g. storedTagColors, storedParentTagColors).
   * @param {string} options.cssTemplateMapKey - The key used for storing template references in `storageObj` (e.g. `_cssTemplates`).
   * @param {Function} options.saveFn - Function to call to save changes (e.g. saveTagColors).
   * @param {Function} options.removeFn - Function to call if removing this item from the store.
   */
  function createColorTemplateRow({
    objKey,
    displayText,
    initColor,
    storageObj,
    cssTemplateMapKey,
    saveFn,
    removeFn,
  }) {
    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'display: flex; flex-direction: column; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #333;';

    // Top row: name + color + remove
    const topRow = document.createElement('div');
    topRow.style.cssText =
      'display: flex; align-items: center; margin-bottom: 5px;';

    const label = document.createElement('span');
    label.textContent = displayText;
    label.style.cssText = 'flex: 1;';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = initColor || '#ffffff';
    colorInput.style.cssText = 'margin-left: 10px; margin-right: 10px;';
    colorInput.addEventListener('input', () => {
      storageObj[objKey] = colorInput.value;
      // If user changes color, reset the template to 'none'
      if (cssTemplateSelect.value !== 'none') {
        cssTemplateSelect.value = 'none';
        if (storageObj[cssTemplateMapKey]) {
          delete storageObj[cssTemplateMapKey][objKey];
        }
      }
      saveFn();
      colorizeTags();
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Remove';
    deleteButton.className = 'btn btn-danger btn-sm';
    deleteButton.style.cssText = 'margin-left: 10px';
    deleteButton.addEventListener('click', () => {
      removeFn();
      wrapper.remove();
      colorizeTags();
    });

    topRow.appendChild(label);
    topRow.appendChild(colorInput);
    topRow.appendChild(deleteButton);
    wrapper.appendChild(topRow);

    // Second row: "CSS Template"
    const templateRow = document.createElement('div');
    templateRow.style.cssText = 'display: flex; align-items: center;';

    const templateLabel = document.createElement('span');
    templateLabel.textContent = 'CSS Template:';
    templateLabel.style.cssText = 'margin-right: 10px; font-size: 0.9em;';

    const cssTemplateSelect = document.createElement('select');
    cssTemplateSelect.style.cssText =
      'flex: 1; color: white; background-color: black; border: 1px solid #555; padding: 3px; border-radius: 3px;';

    // 'none' means "use color only"
    const noneOption = document.createElement('option');
    noneOption.value = 'none';
    noneOption.textContent = '-- Use color only --';
    cssTemplateSelect.appendChild(noneOption);

    // Populate from global storedCssTemplates
    Object.keys(storedCssTemplates).forEach((tmpl) => {
      const opt = document.createElement('option');
      opt.value = tmpl;
      opt.textContent = tmpl;
      cssTemplateSelect.appendChild(opt);
    });

    // If this objKey is mapped to a template, set it
    let mappedTemplateName = null;
    if (
      storageObj[cssTemplateMapKey] &&
      storageObj[cssTemplateMapKey][objKey]
    ) {
      mappedTemplateName = storageObj[cssTemplateMapKey][objKey];
      cssTemplateSelect.value = mappedTemplateName;
    } else {
      cssTemplateSelect.value = 'none';
    }

    cssTemplateSelect.addEventListener('change', () => {
      const val = cssTemplateSelect.value;
      if (val === 'none') {
        // Clear template mapping
        if (storageObj[cssTemplateMapKey]) {
          delete storageObj[cssTemplateMapKey][objKey];
        }
      } else {
        // Assign template
        if (!storageObj[cssTemplateMapKey]) {
          storageObj[cssTemplateMapKey] = {};
        }
        storageObj[cssTemplateMapKey][objKey] = val;
      }
      saveFn();
      colorizeTags();
    });

    templateRow.appendChild(templateLabel);
    templateRow.appendChild(cssTemplateSelect);
    wrapper.appendChild(templateRow);

    return wrapper;
  }

  // Creates a row for a regex pattern → CSS template
  function createRegexTemplateRow(
    template,
    index,
    storageArray,
    saveFunction,
    cssTemplates
  ) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'display: flex; align-items: center; margin-bottom: 10px;';

    const regexInput = document.createElement('input');
    regexInput.type = 'text';
    regexInput.value = template.pattern;
    regexInput.style.cssText = 'flex: 1; margin-right: 10px;';
    regexInput.addEventListener('input', () => {
      storageArray[index].pattern = regexInput.value;
      saveFunction();
      colorizeTags();
    });

    const cssTemplateSelect = document.createElement('select');
    cssTemplateSelect.style.cssText =
      'margin-right: 10px; color: white; background-color: black; border: 1px solid #ccc; padding: 5px; border-radius: 5px; appearance: none;';
    Object.keys(cssTemplates).forEach((templateName) => {
      const option = document.createElement('option');
      option.value = templateName;
      option.textContent = templateName;
      if (templateName === template.cssTemplateName) {
        option.selected = true;
      }
      cssTemplateSelect.appendChild(option);
    });

    cssTemplateSelect.addEventListener('change', () => {
      storageArray[index].cssTemplateName = cssTemplateSelect.value;
      saveFunction();
      colorizeTags();
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Remove';
    deleteButton.className = 'btn btn-danger btn-sm';
    deleteButton.addEventListener('click', () => {
      storageArray.splice(index, 1);
      saveFunction();
      wrapper.remove();
      colorizeTags();
    });

    wrapper.appendChild(regexInput);
    wrapper.appendChild(cssTemplateSelect);
    wrapper.appendChild(deleteButton);
    return wrapper;
  }

  // Parent Group Row (from DB)
  function createParentGroupRow(parentId, parentName, children) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'display: flex; flex-direction: column; margin-bottom: 10px; padding: 5px; border: 1px solid #ccc;';
    const info = document.createElement('div');
    info.textContent = `Parent: ${parentName} (ID: ${parentId})`;
    info.style.cssText = 'font-weight: bold; margin-bottom: 5px;';
    wrapper.appendChild(info);

    const childrenDisplay = document.createElement('div');
    childrenDisplay.textContent = `Children: ${children.join(', ') || 'None'}`;
    childrenDisplay.style.cssText = 'font-style: italic; margin-bottom: 5px;';
    wrapper.appendChild(childrenDisplay);

    const styleWrapper = document.createElement('div');
    styleWrapper.style.cssText = 'display: flex; align-items: center;';

    const styleLabel = document.createElement('span');
    styleLabel.textContent = 'Group Color:';
    styleLabel.style.cssText = 'margin-right: 10px;';
    styleWrapper.appendChild(styleLabel);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value =
      (storedParentGroupStyles[parentId] &&
        storedParentGroupStyles[parentId].color) ||
      '#ffffff';
    colorInput.style.cssText = 'margin-right: 10px;';
    colorInput.addEventListener('input', () => {
      if (!storedParentGroupStyles[parentId]) {
        storedParentGroupStyles[parentId] = {};
      }
      storedParentGroupStyles[parentId].color = colorInput.value;
      delete storedParentGroupStyles[parentId].cssTemplateName;
      saveParentGroupStyles();
      colorizeTags();
    });
    styleWrapper.appendChild(colorInput);

    const cssLabel = document.createElement('span');
    cssLabel.textContent = 'or CSS Template:';
    cssLabel.style.cssText = 'margin: 0 10px;';
    styleWrapper.appendChild(cssLabel);

    const cssSelect = document.createElement('select');
    cssSelect.style.cssText = 'padding: 5px;';
    const blankOption = document.createElement('option');
    blankOption.value = '';
    blankOption.textContent = '-- none --';
    cssSelect.appendChild(blankOption);

    Object.keys(storedCssTemplates).forEach((templateName) => {
      const option = document.createElement('option');
      option.value = templateName;
      option.textContent = templateName;
      cssSelect.appendChild(option);
    });

    if (
      storedParentGroupStyles[parentId] &&
      storedParentGroupStyles[parentId].cssTemplateName
    ) {
      cssSelect.value = storedParentGroupStyles[parentId].cssTemplateName;
    }

    cssSelect.addEventListener('change', () => {
      if (!storedParentGroupStyles[parentId]) {
        storedParentGroupStyles[parentId] = {};
      }
      if (cssSelect.value) {
        storedParentGroupStyles[parentId].cssTemplateName = cssSelect.value;
        delete storedParentGroupStyles[parentId].color;
      } else {
        delete storedParentGroupStyles[parentId].cssTemplateName;
      }
      saveParentGroupStyles();
      colorizeTags();
    });

    styleWrapper.appendChild(cssSelect);
    wrapper.appendChild(styleWrapper);

    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // 8. The Tag Manager Modal (4 Tabs)
  // ---------------------------------------------------------------------------
  function openTagManagerModal() {
    if (document.getElementById('tag-manager-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'tag-manager-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100vh;
      background-color: rgba(0, 0, 0, 0.6);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) document.body.removeChild(overlay);
    });

    const modal = document.createElement('div');
    modal.id = 'tag-manager-modal';
    modal.style.cssText = `
      background-color: rgba(0, 0, 0, 0.95);
      color: #fff;
      padding: 20px;
      border-radius: 10px;
      width: 800px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    `;
    modal.innerHTML = `<h2 style="margin-bottom: 20px;">Manage Tag Colors and Templates</h2>`;

    // Create Tabs
    const tabButtons = ['CSS Templates', 'Tags', 'Parent Tags', 'Sort Names'];
    const tabContents = [];
    const tabs = document.createElement('div');
    tabs.style.cssText = 'display: flex; margin-bottom: 20px;';

    tabButtons.forEach((tabName, index) => {
      const tabButton = document.createElement('button');
      tabButton.textContent = tabName;
      tabButton.className = 'btn btn-secondary';
      tabButton.style.cssText = `
        flex: 1;
        margin-right: 5px;
        ${index === 0 ? 'background-color: #007bff; color: #fff;' : ''}
      `;
      tabButton.addEventListener('click', () => {
        tabButtons.forEach((_, idx) => {
          tabContents[idx].style.display = idx === index ? 'block' : 'none';
          tabs.children[idx].style.backgroundColor =
            idx === index ? '#007bff' : '';
          tabs.children[idx].style.color = idx === index ? '#fff' : '';
          if (idx === index && tabName === 'Sort Names') {
            populateSortNamesTab(tabContents[idx]);
          }
        });
      });
      tabs.appendChild(tabButton);
    });
    modal.appendChild(tabs);

    // Prepare the 4 content divs
    for (let i = 0; i < tabButtons.length; i++) {
      const contentDiv = document.createElement('div');
      contentDiv.style.display = i === 0 ? 'block' : 'none';
      tabContents.push(contentDiv);
      modal.appendChild(contentDiv);
    }

    // ------------------------------
    // Tab 1: CSS Templates
    // ------------------------------
    const templatesContent = tabContents[0];
    templatesContent.innerHTML = `
      <h3>CSS Templates</h3>
      <p class="text-muted">Define reusable style templates that can be applied to tags, parent tags, or sort names.</p>
      <div id="css-templates-list"></div>
      <div id="add-css-template-container"></div>

      <hr style="margin: 30px 0; border-color: #444;">

      <h4>CSS Properties Reference</h4>
      <div class="alert alert-info" style="margin-top: 10px;">
        <p>Common CSS properties you can use in templates:</p>
        <ul>
          <li><code>backgroundColor</code> - e.g., "#RRGGBB"</li>
          <li><code>color</code> - e.g., "#FFFFFF"</li>
          <li><code>borderRadius</code> - e.g., "5px"</li>
          <li><code>padding</code> - e.g., "2px 6px"</li>
          <li><code>fontWeight</code> - e.g., "bold"</li>
          <li><code>border</code> - e.g., "1px solid #FF0000"</li>
          <li><code>boxShadow</code> - e.g., "0 2px 4px rgba(0,0,0,0.5)"</li>
        </ul>
      </div>
    `;

    // Populate existing CSS templates
    const cssTemplatesList = templatesContent.querySelector(
      '#css-templates-list'
    );
    Object.entries(storedCssTemplates).forEach(([templateName, cssProps]) => {
      cssTemplatesList.appendChild(
        createCssTemplateInput(templateName, cssProps)
      );
    });

    // Add new CSS Template UI
    const addCssContainer = templatesContent.querySelector(
      '#add-css-template-container'
    );
    const newCssTemplateWrapper = document.createElement('div');
    newCssTemplateWrapper.style.cssText =
      'display: flex; flex-direction: column; margin-top: 20px;';

    const newCssTemplateNameInput = document.createElement('input');
    newCssTemplateNameInput.type = 'text';
    newCssTemplateNameInput.placeholder = 'New CSS Template Name';
    newCssTemplateNameInput.style.cssText =
      'width: 100%; margin-bottom: 10px; padding: 5px;';
    newCssTemplateWrapper.appendChild(newCssTemplateNameInput);

    const newCssTemplateTextarea = document.createElement('textarea');
    newCssTemplateTextarea.placeholder = 'CSS Properties (JSON format)';
    newCssTemplateTextarea.style.cssText =
      'width: 100%; height: 120px; margin-bottom: 10px; padding: 5px; font-family: monospace;';
    newCssTemplateTextarea.value = JSON.stringify(
      {
        backgroundColor: '#4a90e2',
        color: '#FFFFFF',
        borderRadius: '5px',
        padding: '2px 6px',
        fontWeight: 'bold',
      },
      null,
      2
    );
    newCssTemplateWrapper.appendChild(newCssTemplateTextarea);

    const newCssTemplateConfirmButton = document.createElement('button');
    newCssTemplateConfirmButton.textContent = 'Add CSS Template';
    newCssTemplateConfirmButton.className = 'btn btn-primary';
    newCssTemplateConfirmButton.style.cssText =
      'align-self: center; margin-top: 10px;';
    newCssTemplateWrapper.appendChild(newCssTemplateConfirmButton);

    newCssTemplateConfirmButton.addEventListener('click', () => {
      const tmplName = newCssTemplateNameInput.value.trim();
      let cssProps;
      try {
        cssProps = JSON.parse(newCssTemplateTextarea.value);
      } catch (e) {
        alert('Invalid CSS properties JSON');
        return;
      }
      if (tmplName && cssProps) {
        storedCssTemplates[tmplName] = cssProps;
        cssTemplatesList.appendChild(
          createCssTemplateInput(tmplName, cssProps)
        );
        newCssTemplateNameInput.value = '';
        newCssTemplateTextarea.value = JSON.stringify(
          {
            backgroundColor: '#4a90e2',
            color: '#FFFFFF',
            borderRadius: '5px',
            padding: '2px 6px',
            fontWeight: 'bold',
          },
          null,
          2
        );
        saveCssTemplates();
        colorizeTags();
      }
    });

    addCssContainer.appendChild(newCssTemplateWrapper);

    // ------------------------------
    // Tab 2: Regular Tags
    // ------------------------------
    const tagsContent = tabContents[1];
    tagsContent.innerHTML = `
      <h3>Regular Tag Colors</h3>
      <p class="text-muted">Assign colors or templates to specific tags (directly or via regex).</p>
      <div class="tag-settings-container">
        <div class="tag-colors-section">
          <h4>Custom Tag Colors</h4>
          <div id="tag-colors-list"></div>
          <div id="add-tag-color-container"></div>
        </div>

        <hr style="margin: 20px 0;">

        <div class="tag-regex-section">
          <h4>Tag Pattern Matching</h4>
          <p>Match tags using regex patterns and apply CSS templates.</p>
          <div id="regex-templates-list"></div>
          <div id="add-regex-template-container"></div>
        </div>
      </div>
    `;

    // Populate Tag Colors
    const tagColorsList = tagsContent.querySelector('#tag-colors-list');
    Object.entries(storedTagColors).forEach(([tagName, color]) => {
      if (tagName === '_cssTemplates') return; // skip special key
      tagColorsList.appendChild(
        createColorTemplateRow({
          objKey: tagName,
          displayText: tagName,
          initColor: color,
          storageObj: storedTagColors,
          cssTemplateMapKey: '_cssTemplates',
          saveFn: saveTagColors,
          removeFn: () => {
            delete storedTagColors[tagName];
            saveTagColors();
          },
        })
      );
    });

    // Add Tag UI
    const addTagContainer = tagsContent.querySelector(
      '#add-tag-color-container'
    );
    const newTagWrapper = document.createElement('div');
    newTagWrapper.style.cssText =
      'display: flex; flex-direction: column; align-items: start; margin-top: 10px;';

    const newTagInput = document.createElement('input');
    newTagInput.type = 'text';
    newTagInput.placeholder = 'New Tag Name';
    newTagInput.style.cssText =
      'width: 100%; margin-bottom: 10px; padding: 5px;';
    newTagWrapper.appendChild(newTagInput);

    const suggestions = document.createElement('ul');
    suggestions.style.cssText = `
      list-style: none; margin: 0; padding: 0; width: 100%;
      background: #fff; color: #000; border-radius: 5px;
      overflow-y: auto; max-height: 150px;
    `;
    newTagWrapper.appendChild(suggestions);

    const newTagConfirmButton = document.createElement('button');
    newTagConfirmButton.textContent = 'Add Tag';
    newTagConfirmButton.className = 'btn btn-primary btn-sm';
    newTagConfirmButton.style.cssText = 'align-self: center; margin-top: 10px;';
    newTagWrapper.appendChild(newTagConfirmButton);

    // Suggestions logic
    newTagInput.addEventListener(
      'input',
      debounce(async () => {
        const txt = newTagInput.value.trim();
        if (!txt) {
          suggestions.innerHTML = '';
          return;
        }
        const foundTags = await queryTags(txt);
        suggestions.innerHTML = '';
        foundTags.forEach((tg) => {
          const li = document.createElement('li');
          li.textContent = tg.name;
          li.style.cssText =
            'padding: 5px 10px; cursor: pointer; border-bottom: 1px solid #ccc;';
          li.addEventListener('click', () => {
            newTagInput.value = tg.name;
            suggestions.innerHTML = '';
          });
          suggestions.appendChild(li);
        });
      }, 300)
    );

    newTagConfirmButton.addEventListener('click', () => {
      const tagName = newTagInput.value.trim();
      if (tagName && !storedTagColors[tagName]) {
        storedTagColors[tagName] = '#ffffff';
        tagColorsList.appendChild(
          createColorTemplateRow({
            objKey: tagName,
            displayText: tagName,
            initColor: '#ffffff',
            storageObj: storedTagColors,
            cssTemplateMapKey: '_cssTemplates',
            saveFn: saveTagColors,
            removeFn: () => {
              delete storedTagColors[tagName];
              saveTagColors();
            },
          })
        );
        newTagInput.value = '';
        suggestions.innerHTML = '';
        saveTagColors();
        colorizeTags();
      }
    });

    addTagContainer.appendChild(newTagWrapper);

    // Populate Tag Regex Patterns
    const regexTemplatesList = tagsContent.querySelector(
      '#regex-templates-list'
    );
    storedRegexTemplates.forEach((tpl, i) => {
      regexTemplatesList.appendChild(
        createRegexTemplateRow(
          tpl,
          i,
          storedRegexTemplates,
          saveRegexTemplates,
          storedCssTemplates
        )
      );
    });

    // Add Regex Template
    const addRegexContainer = tagsContent.querySelector(
      '#add-regex-template-container'
    );
    const newRegexWrapper = document.createElement('div');
    newRegexWrapper.style.cssText =
      'display: flex; flex-direction: column; align-items: start; margin-top: 10px;';

    const newRegexInput = document.createElement('input');
    newRegexInput.type = 'text';
    newRegexInput.placeholder = 'New Regex Pattern (e.g. ^important$)';
    newRegexInput.style.cssText =
      'width: 100%; margin-bottom: 10px; padding: 5px;';
    newRegexWrapper.appendChild(newRegexInput);

    const cssTemplateSelect = document.createElement('select');
    cssTemplateSelect.style.cssText =
      'width: 100%; margin-bottom: 10px; padding: 5px;';
    Object.keys(storedCssTemplates).forEach((templateName) => {
      const option = document.createElement('option');
      option.value = templateName;
      option.textContent = templateName;
      cssTemplateSelect.appendChild(option);
    });
    newRegexWrapper.appendChild(cssTemplateSelect);

    const newRegexConfirmButton = document.createElement('button');
    newRegexConfirmButton.textContent = 'Add Regex Pattern';
    newRegexConfirmButton.className = 'btn btn-primary btn-sm';
    newRegexConfirmButton.style.cssText =
      'align-self: center; margin-top: 10px;';
    newRegexWrapper.appendChild(newRegexConfirmButton);

    newRegexConfirmButton.addEventListener('click', () => {
      const pattern = newRegexInput.value.trim();
      const cssTemplateName = cssTemplateSelect.value;
      if (pattern && cssTemplateName) {
        const newTpl = { pattern, cssTemplateName };
        storedRegexTemplates.push(newTpl);
        regexTemplatesList.appendChild(
          createRegexTemplateRow(
            newTpl,
            storedRegexTemplates.length - 1,
            storedRegexTemplates,
            saveRegexTemplates,
            storedCssTemplates
          )
        );
        newRegexInput.value = '';
        saveRegexTemplates();
        colorizeTags();
      }
    });
    addRegexContainer.appendChild(newRegexWrapper);

    // ------------------------------
    // Tab 3: Parent Tags
    // ------------------------------
    const parentTagsContent = tabContents[2];
    parentTagsContent.innerHTML = `
      <h3>Parent Tag Settings</h3>
      <p class="text-muted">Manage parent tags (by ID), or apply regex patterns or group-based styling.</p>
      <div class="parent-settings-container">
        <div class="parent-colors-section">
          <h4>Manual Parent Tag Assignments</h4>
          <div id="parent-tag-colors-list"></div>
          <div id="add-parent-tag-container"></div>
        </div>

        <hr style="margin: 20px 0;">

        <div class="parent-regex-section">
          <h4>Parent Tag Pattern Matching</h4>
          <div id="parent-regex-templates-list"></div>
          <div id="add-parent-regex-container"></div>
        </div>

        <hr style="margin: 20px 0;">

        <div class="parent-groups-section">
          <h4>Parent-Child Groupings from DB</h4>
          <p>Automatically fetched groupings (for applying a single color or template).</p>
          <div id="parent-groupings-list">
            <p>Loading groupings...</p>
          </div>
        </div>
      </div>
    `;

    // Parent manual color assignments
    const parentTagColorsList = parentTagsContent.querySelector(
      '#parent-tag-colors-list'
    );
    Object.entries(storedParentMapping).forEach(([parentId, mapping]) => {
      parentTagColorsList.appendChild(
        createColorTemplateRow({
          objKey: parentId,
          displayText: `ID: ${parentId} | ${mapping.name}`,
          initColor: storedParentTagColors[parentId] || '#ffffff',
          storageObj: storedParentTagColors,
          cssTemplateMapKey: '_cssTemplates',
          saveFn: saveParentTagColors,
          removeFn: () => {
            delete storedParentMapping[parentId];
            delete storedParentTagColors[parentId];
            saveParentMapping();
            saveParentTagColors();
          },
        })
      );
    });

    // Add Parent Tag (by ID)
    const addParentTagContainer = parentTagsContent.querySelector(
      '#add-parent-tag-container'
    );
    const newParentTagWrapper = document.createElement('div');
    newParentTagWrapper.style.cssText =
      'display: flex; flex-direction: column; align-items: start; margin-top: 10px;';

    const newParentTagInput = document.createElement('input');
    newParentTagInput.type = 'text';
    newParentTagInput.placeholder = 'Parent Tag ID';
    newParentTagInput.style.cssText =
      'width: 100%; margin-bottom: 10px; padding: 5px;';
    newParentTagWrapper.appendChild(newParentTagInput);

    const newParentTagConfirmButton = document.createElement('button');
    newParentTagConfirmButton.textContent = 'Add Parent Tag';
    newParentTagConfirmButton.className = 'btn btn-primary btn-sm';
    newParentTagConfirmButton.style.cssText =
      'align-self: center; margin-top: 10px;';
    newParentTagWrapper.appendChild(newParentTagConfirmButton);

    newParentTagConfirmButton.addEventListener('click', async () => {
      const tagId = newParentTagInput.value.trim();
      if (!tagId) return;
      const query = `
        query FindTag($id: ID!) {
          findTag(id: $id) {
            id
            name
            children { id name }
          }
        }
      `;
      const variables = { id: tagId };
      try {
        const response = await fetch(gqlEndpoint, {
          method: 'POST',
          headers: gqlHeaders(),
          body: JSON.stringify({ query, variables }),
        });
        const data = await response.json();
        const parentData = data?.data?.findTag || null;
        if (parentData) {
          const parentName = parentData.name;
          const children = (parentData.children || []).map((c) => c.name);
          storedParentMapping[parentData.id] = {
            name: parentName,
            children: children,
          };
          if (!storedParentTagColors[parentData.id]) {
            storedParentTagColors[parentData.id] = '#ffffff';
          }
          parentTagColorsList.appendChild(
            createColorTemplateRow({
              objKey: parentData.id,
              displayText: `ID: ${parentData.id} | ${parentName}`,
              initColor: storedParentTagColors[parentData.id],
              storageObj: storedParentTagColors,
              cssTemplateMapKey: '_cssTemplates',
              saveFn: saveParentTagColors,
              removeFn: () => {
                delete storedParentMapping[parentData.id];
                delete storedParentTagColors[parentData.id];
                saveParentMapping();
                saveParentTagColors();
              },
            })
          );
          newParentTagInput.value = '';
          saveParentMapping();
          saveParentTagColors();
          colorizeTags();
        } else {
          alert('Parent tag not found. Check ID.');
        }
      } catch (error) {
        console.error('Error querying tag by id:', error);
      }
    });
    addParentTagContainer.appendChild(newParentTagWrapper);

    // Parent Regex Templates
    const parentRegexList = parentTagsContent.querySelector(
      '#parent-regex-templates-list'
    );
    storedParentRegexTemplates.forEach((tpl, i) => {
      parentRegexList.appendChild(
        createRegexTemplateRow(
          tpl,
          i,
          storedParentRegexTemplates,
          saveParentRegexTemplates,
          storedCssTemplates
        )
      );
    });

    // Add Parent Regex Template
    const addParentRegexContainer = parentTagsContent.querySelector(
      '#add-parent-regex-container'
    );
    const newParentRegexWrapper = document.createElement('div');
    newParentRegexWrapper.style.cssText =
      'display: flex; flex-direction: column; align-items: start; margin-top: 10px;';

    const newParentRegexInput = document.createElement('input');
    newParentRegexInput.type = 'text';
    newParentRegexInput.placeholder = 'New Regex Pattern';
    newParentRegexInput.style.cssText =
      'width: 100%; margin-bottom: 10px; padding: 5px;';
    newParentRegexWrapper.appendChild(newParentRegexInput);

    const parentCssTemplateSelect = document.createElement('select');
    parentCssTemplateSelect.style.cssText =
      'width: 100%; margin-bottom: 10px; padding: 5px;';
    Object.keys(storedCssTemplates).forEach((templateName) => {
      const option = document.createElement('option');
      option.value = templateName;
      option.textContent = templateName;
      parentCssTemplateSelect.appendChild(option);
    });
    newParentRegexWrapper.appendChild(parentCssTemplateSelect);

    const newParentRegexConfirmButton = document.createElement('button');
    newParentRegexConfirmButton.textContent = 'Add Regex Pattern';
    newParentRegexConfirmButton.className = 'btn btn-primary btn-sm';
    newParentRegexConfirmButton.style.cssText =
      'align-self: center; margin-top: 10px;';
    newParentRegexWrapper.appendChild(newParentRegexConfirmButton);

    newParentRegexConfirmButton.addEventListener('click', () => {
      const pattern = newParentRegexInput.value.trim();
      const cssTemplateName = parentCssTemplateSelect.value;
      if (pattern && cssTemplateName) {
        const newTpl = { pattern, cssTemplateName };
        storedParentRegexTemplates.push(newTpl);
        parentRegexList.appendChild(
          createRegexTemplateRow(
            newTpl,
            storedParentRegexTemplates.length - 1,
            storedParentRegexTemplates,
            saveParentRegexTemplates,
            storedCssTemplates
          )
        );
        newParentRegexInput.value = '';
        saveParentRegexTemplates();
        colorizeTags();
      }
    });
    addParentRegexContainer.appendChild(newParentRegexWrapper);

    // Load DB parent groupings
    const parentGroupingsList = parentTagsContent.querySelector(
      '#parent-groupings-list'
    );
    fetchParentChildGroupings().then((groups) => {
      fetchedParentGroups = groups;
      parentGroupingsList.innerHTML = '';
      if (groups.length === 0) {
        parentGroupingsList.innerHTML = '<p>No parent groupings found.</p>';
        return;
      }
      groups.forEach((grp) => {
        parentGroupingsList.appendChild(
          createParentGroupRow(
            grp.id,
            grp.name,
            grp.children.map((c) => c.name)
          )
        );
      });
    });

    // ------------------------------
    // Tab 4: Sort Names
    // ------------------------------
    const sortNamesContent = tabContents[3];
    sortNamesContent.innerHTML = `
      <h3>Sort Name Styling</h3>
      <p class="text-muted">Sort Name styles have the highest priority and override other styles.</p>
      <div class="sort-name-container">
        <div class="sort-name-section">
          <h4>Sort Name Colors/Templates</h4>
          <div id="sort-name-colors-list"></div>
        </div>

        <hr style="margin: 20px 0;">

        <div class="sort-name-regex-section">
          <h4>Sort Name Pattern Matching</h4>
          <div id="sort-name-regex-templates-list"></div>
          <div id="add-sort-name-regex-container"></div>
        </div>
      </div>
    `;

    async function populateSortNamesTab(container) {
      const sortNameColorsList = container.querySelector(
        '#sort-name-colors-list'
      );
      sortNameColorsList.innerHTML = '';

      const sortTags = await fetchSortNames();
      const uniqueSortNames = new Set(
        sortTags.map((t) => t.sort_name).filter(Boolean)
      );

      // Ensure each known sort_name has a color entry
      uniqueSortNames.forEach((sn) => {
        if (!storedSortNameColors[sn]) {
          storedSortNameColors[sn] = '#ffffff';
        }
      });

      // Display each
      uniqueSortNames.forEach((sn) => {
        sortNameColorsList.appendChild(
          createColorTemplateRow({
            objKey: sn,
            displayText: sn,
            initColor: storedSortNameColors[sn],
            storageObj: storedSortNameColors,
            cssTemplateMapKey: '_cssTemplates',
            saveFn: saveSortNameColors,
            removeFn: () => {
              delete storedSortNameColors[sn];
              saveSortNameColors();
            },
          })
        );
      });

      // Sort Name Regex
      const sortNameRegexList = container.querySelector(
        '#sort-name-regex-templates-list'
      );
      sortNameRegexList.innerHTML = '';
      storedSortNameRegexTemplates.forEach((tpl, i) => {
        sortNameRegexList.appendChild(
          createRegexTemplateRow(
            tpl,
            i,
            storedSortNameRegexTemplates,
            saveSortNameRegexTemplates,
            storedCssTemplates
          )
        );
      });

      // Add new Sort Name Regex
      const addSortNameRegexContainer = container.querySelector(
        '#add-sort-name-regex-container'
      );
      addSortNameRegexContainer.innerHTML = '';
      const newSortNameRegexWrapper = document.createElement('div');
      newSortNameRegexWrapper.style.cssText =
        'display: flex; flex-direction: column; align-items: start; margin-top: 10px;';

      const newSortNameRegexInput = document.createElement('input');
      newSortNameRegexInput.type = 'text';
      newSortNameRegexInput.placeholder = 'New Sort Name Regex Pattern';
      newSortNameRegexInput.style.cssText =
        'width: 100%; margin-bottom: 10px; padding: 5px;';
      newSortNameRegexWrapper.appendChild(newSortNameRegexInput);

      const sortNameCssTemplateSelect = document.createElement('select');
      sortNameCssTemplateSelect.style.cssText =
        'width: 100%; margin-bottom: 10px; padding: 5px;';
      Object.keys(storedCssTemplates).forEach((templateName) => {
        const option = document.createElement('option');
        option.value = templateName;
        option.textContent = templateName;
        sortNameCssTemplateSelect.appendChild(option);
      });
      newSortNameRegexWrapper.appendChild(sortNameCssTemplateSelect);

      const newSortNameRegexConfirmButton = document.createElement('button');
      newSortNameRegexConfirmButton.textContent = 'Add Regex Pattern';
      newSortNameRegexConfirmButton.className = 'btn btn-primary btn-sm';
      newSortNameRegexConfirmButton.style.cssText =
        'align-self: center; margin-top: 10px;';
      newSortNameRegexWrapper.appendChild(newSortNameRegexConfirmButton);

      newSortNameRegexConfirmButton.addEventListener('click', () => {
        const pattern = newSortNameRegexInput.value.trim();
        const cssTemplateName = sortNameCssTemplateSelect.value;
        if (pattern && cssTemplateName) {
          const newTpl = { pattern, cssTemplateName };
          storedSortNameRegexTemplates.push(newTpl);
          sortNameRegexList.appendChild(
            createRegexTemplateRow(
              newTpl,
              storedSortNameRegexTemplates.length - 1,
              storedSortNameRegexTemplates,
              saveSortNameRegexTemplates,
              storedCssTemplates
            )
          );
          newSortNameRegexInput.value = '';
          saveSortNameRegexTemplates();
          colorizeTags();
        }
      });

      addSortNameRegexContainer.appendChild(newSortNameRegexWrapper);
    }

    // Pre-load the Sort Names tab content just in case
    populateSortNamesTab(sortNamesContent);

    // Additional info about precedence & Export/Import
    const precedenceInfo = document.createElement('div');
    precedenceInfo.className = 'alert alert-secondary';
    precedenceInfo.style.marginTop = '20px';
    precedenceInfo.innerHTML = `
      <h5>Style Precedence</h5>
      <p>Tag styles are applied in the following order (highest priority first):</p>
      <ol>
        <li>Sort Name styles</li>
        <li>Parent Tag styles</li>
        <li>Regular Tag styles</li>
      </ol>
      <p>Within each category, direct color assignments override regex pattern matches.</p>
    `;
    modal.appendChild(precedenceInfo);

    const buttonWrapper = document.createElement('div');
    buttonWrapper.style.cssText =
      'display: flex; justify-content: space-between; margin-top: 20px;';

    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export All Settings';
    exportButton.className = 'btn btn-secondary';
    exportButton.addEventListener('click', exportTagColors);

    const importButton = document.createElement('button');
    importButton.textContent = 'Import Settings';
    importButton.className = 'btn btn-secondary';
    importButton.addEventListener('click', importTagColors);

    buttonWrapper.appendChild(exportButton);
    buttonWrapper.appendChild(importButton);
    modal.appendChild(buttonWrapper);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // Create CSS Template Input row
  function createCssTemplateInput(templateName, cssProperties) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom: 20px;';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = templateName;
    nameInput.style.cssText = 'width: 100%; margin-bottom: 5px; padding: 5px;';
    nameInput.addEventListener('input', () => {
      const newName = nameInput.value.trim();
      if (newName && newName !== templateName) {
        // Rename key in storedCssTemplates
        storedCssTemplates[newName] = storedCssTemplates[templateName];
        delete storedCssTemplates[templateName];
        saveCssTemplates();
        templateName = newName;
        colorizeTags();
      }
    });

    const cssTextarea = document.createElement('textarea');
    cssTextarea.value = JSON.stringify(cssProperties, null, 4);
    cssTextarea.style.cssText =
      'width: 100%; height: 100px; margin-bottom: 5px; padding: 5px; font-family: monospace;';
    cssTextarea.addEventListener('input', () => {
      try {
        storedCssTemplates[templateName] = JSON.parse(cssTextarea.value);
        saveCssTemplates();
        colorizeTags();
      } catch (e) {
        console.error('Invalid CSS properties JSON');
      }
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Remove';
    deleteButton.className = 'btn btn-danger btn-sm';
    deleteButton.addEventListener('click', () => {
      delete storedCssTemplates[templateName];
      saveCssTemplates();
      wrapper.remove();
      colorizeTags();
    });

    wrapper.appendChild(nameInput);
    wrapper.appendChild(cssTextarea);
    wrapper.appendChild(deleteButton);

    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // 9. Export & Import
  // ---------------------------------------------------------------------------
  function exportTagColors() {
    const data = {
      tagColors: storedTagColors,
      regexTemplates: storedRegexTemplates,
      cssTemplates: storedCssTemplates,
      sortNameColors: storedSortNameColors,
      sortNameRegexTemplates: storedSortNameRegexTemplates,
      parentTagColors: storedParentTagColors,
      parentRegexTemplates: storedParentRegexTemplates,
      parentMapping: storedParentMapping,
      parentGroupStyles: storedParentGroupStyles,
    };
    const blob = new Blob([JSON.stringify(data, null, 4)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stashCustomTagColors.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('Exported data to stashCustomTagColors.json');
  }

  function importTagColors() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported.tagColors) {
            Object.assign(storedTagColors, imported.tagColors);
            saveTagColors();
          }
          if (imported.regexTemplates) {
            storedRegexTemplates.length = 0;
            storedRegexTemplates.push(...imported.regexTemplates);
            saveRegexTemplates();
          }
          if (imported.cssTemplates) {
            Object.assign(storedCssTemplates, imported.cssTemplates);
            saveCssTemplates();
          }
          if (imported.sortNameColors) {
            Object.assign(storedSortNameColors, imported.sortNameColors);
            saveSortNameColors();
          }
          if (imported.sortNameRegexTemplates) {
            storedSortNameRegexTemplates.length = 0;
            storedSortNameRegexTemplates.push(
              ...imported.sortNameRegexTemplates
            );
            saveSortNameRegexTemplates();
          }
          if (imported.parentTagColors) {
            Object.assign(storedParentTagColors, imported.parentTagColors);
            saveParentTagColors();
          }
          if (imported.parentRegexTemplates) {
            storedParentRegexTemplates.length = 0;
            storedParentRegexTemplates.push(...imported.parentRegexTemplates);
            saveParentRegexTemplates();
          }
          if (imported.parentMapping) {
            Object.assign(storedParentMapping, imported.parentMapping);
            saveParentMapping();
          }
          if (imported.parentGroupStyles) {
            Object.assign(storedParentGroupStyles, imported.parentGroupStyles);
            saveParentGroupStyles();
          }
          colorizeTags();
          console.log('Imported data from JSON file:', imported);
          alert(
            'Import successful! Close and reopen the Tag Manager to see changes.'
          );
        } catch (error) {
          console.error('Error importing JSON file:', error);
          alert('Failed to import data. Please ensure it is valid JSON.');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  // ---------------------------------------------------------------------------
  // 10. Create a "Tag Manager" button in the navbar
  // ---------------------------------------------------------------------------
  function createTagManagerButton(target) {
    if (document.getElementById('tag-manager-button')) return;
    const button = document.createElement('button');
    button.id = 'tag-manager-button';
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.style.cssText =
      'margin-left: 8px; display: flex; align-items: center;';
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" style="width: 1.2em; height: 1.2em; margin-right: 5px;">
        <path fill="white" d="M0 64C0 28.7 28.7 0 64 0L352 0c35.3 0 64 28.7 64 64l0 64c0 35.3-28.7 64-64 64L64 192c-35.3 0-64-28.7-64-64L0 64zM160 352c0-17.7 14.3-32 32-32l0-16c0-44.2 35.8-80 80-80l144 0c17.7 0 32-14.3 32-32l0-32 0-90.5c37.3 13.2 64 48.7 64 90.5l0 32c0 53-43 96-96 96l-144 0c-8.8 0-16 7.2-16 16l0 16c17.7 0 32 14.3 32 32l0 128c0 17.7-14.3 32-32 32l-64 0c-17.7 0-32-14.3-32-32l0-128z"/>
      </svg>
      Tag Manager
    `;
    button.addEventListener('click', openTagManagerModal);
    target.appendChild(button);
    console.log('Tag Manager button added.');
  }

  // Observe for the navbar to appear, then add the "Tag Manager" button
  const observerNavbar = new MutationObserver(() => {
    const navbar = document.querySelector('.navbar-buttons');
    if (navbar) {
      createTagManagerButton(navbar);
      observerNavbar.disconnect();
    }
  });
  observerNavbar.observe(document.body, { childList: true, subtree: true });

  // Initial colorize
  colorizeTags();
})();
