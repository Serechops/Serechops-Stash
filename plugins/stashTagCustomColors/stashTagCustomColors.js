(async function () {
    'use strict';

    console.log("Tag Colorization Script started");

    // Load stored data or initialize default values
    const storedTagColors = JSON.parse(localStorage.getItem('tagColors')) || {};
    const storedRegexTemplates = JSON.parse(localStorage.getItem('regexTemplates')) || [
        // Default regex templates
        { pattern: '^Important$', cssTemplateName: 'ImportantTag' },
        { pattern: '^Todo$', cssTemplateName: 'TodoTag' },
    ];
    const storedCssTemplates = JSON.parse(localStorage.getItem('cssTemplates')) || {
        // Default CSS templates
        'ImportantTag': {
            backgroundColor: '#FF0000',
            color: '#FFFFFF',
            borderRadius: '5px',
            padding: '2px 6px',
        },
        'TodoTag': {
            backgroundColor: '#FFA500',
            color: '#000000',
            borderRadius: '5px',
            padding: '2px 6px',
        },
    };

    // Save functions
    const saveTagColors = () => {
        localStorage.setItem('tagColors', JSON.stringify(storedTagColors));
        console.log("Tag colors saved:", storedTagColors);
    };

    const saveRegexTemplates = () => {
        localStorage.setItem('regexTemplates', JSON.stringify(storedRegexTemplates));
        console.log("Regex templates saved:", storedRegexTemplates);
    };

    const saveCssTemplates = () => {
        localStorage.setItem('cssTemplates', JSON.stringify(storedCssTemplates));
        console.log("CSS templates saved:", storedCssTemplates);
    };

    // Apply styles to tags
    const applyTagStyles = (tagElement) => {
        const tagName = tagElement.textContent.trim();
        console.log(`Processing tag: "${tagName}"`);

        // Check regex templates first
        for (let template of storedRegexTemplates) {
            let regex;
            try {
                regex = new RegExp(template.pattern, 'i'); // Case-insensitive
            } catch (e) {
                console.error(`Invalid regex pattern: ${template.pattern}`);
                continue;
            }
            if (regex.test(tagName)) {
                console.log(`Applying CSS template "${template.cssTemplateName}" to tag: "${tagName}"`);
                const cssTemplate = storedCssTemplates[template.cssTemplateName];
                if (cssTemplate) {
                    Object.entries(cssTemplate).forEach(([key, value]) => {
                        tagElement.style[key] = value;
                    });
                    return; // Style applied
                } else {
                    console.warn(`CSS template "${template.cssTemplateName}" not found`);
                }
            }
        }

        // Apply stored tag color if no regex match
        if (storedTagColors[tagName]) {
            console.log(`Applying color ${storedTagColors[tagName]} to tag: "${tagName}"`);
            tagElement.style.backgroundColor = storedTagColors[tagName];
            tagElement.style.color = "#FFFFFF";
            tagElement.style.borderRadius = "5px";
            tagElement.style.padding = "2px 6px";
        }
    };

    // Colorize tags in the DOM
    const colorizeTags = () => {
        requestAnimationFrame(() => {
            document.querySelectorAll(".react-select__multi-value__label, .tag-item").forEach(tag => {
                applyTagStyles(tag);
            });
        });
    };

    // Debounce function to optimize performance
    const debouncedColorizeTags = debounce(colorizeTags, 200);

    // Observe DOM changes
    const observer = new MutationObserver(debouncedColorizeTags);
    observer.observe(document.body, { childList: true, subtree: true });

    console.log("Tag Colorization Script initialized");

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    // GraphQL query functions
    const gqlEndpoint = '/graphql';
    const apiKey = localStorage.getItem('apiKey') || null;

    const gqlHeaders = () => {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        return headers;
    };

    const queryTags = async (tagName) => {
        const query = `
            query FindTags($name: String!) {
                findTags(
                    tag_filter: { name: { value: $name, modifier: INCLUDES } }
                    filter: { per_page: -1 }
                ) {
                    tags {
                        id
                        name
                    }
                }
            }
        `;
        const variables = { name: tagName };
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

    // Open Tag Manager Modal
    const openTagManagerModal = () => {
        if (document.getElementById('tag-manager-modal')) return;

        const overlay = document.createElement('div');
        overlay.id = 'tag-manager-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.6);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        const modal = document.createElement('div');
        modal.id = 'tag-manager-modal';
        modal.style.cssText = `
            background-color: rgba(0, 0, 0, 0.95);
            color: #fff;
            padding: 20px;
            border-radius: 10px;
            width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
        `;
        modal.innerHTML = `<h2 style="margin-bottom: 20px;">Manage Tag Colors and Templates</h2>`;

        // Tab navigation
        const tabs = document.createElement('div');
        tabs.style.cssText = 'display: flex; margin-bottom: 20px;';

        const tabButtons = ['Tag Colors', 'Regex Templates', 'CSS Templates'];
        const tabContents = [];

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
                    tabs.children[idx].style.backgroundColor = idx === index ? '#007bff' : '';
                    tabs.children[idx].style.color = idx === index ? '#fff' : '';
                });
            });
            tabs.appendChild(tabButton);
        });

        modal.appendChild(tabs);

        // Tab Content Containers
        const tagColorsContent = document.createElement('div');
        tagColorsContent.style.display = 'block'; // Default visible

        const regexTemplatesContent = document.createElement('div');
        regexTemplatesContent.style.display = 'none';

        const cssTemplatesContent = document.createElement('div');
        cssTemplatesContent.style.display = 'none';

        tabContents.push(tagColorsContent, regexTemplatesContent, cssTemplatesContent);

        // Tag Colors Section
        tagColorsContent.innerHTML = `<h3>Tag Colors</h3>`;

        Object.entries(storedTagColors).forEach(([tag, color]) => {
            tagColorsContent.appendChild(createTagColorInput(tag, color));
        });

        // New Tag Input
        const newTagWrapper = document.createElement('div');
        newTagWrapper.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: start;
            margin-top: 10px;
        `;

        const newTagInput = document.createElement('input');
        newTagInput.type = 'text';
        newTagInput.placeholder = 'New Tag Name';
        newTagInput.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 5px;';
        newTagWrapper.appendChild(newTagInput);

        const suggestions = document.createElement('ul');
        suggestions.style.cssText = `
            list-style: none;
            margin: 0;
            padding: 0;
            width: 100%;
            background: #fff;
            color: #000;
            border-radius: 5px;
            overflow-y: auto;
            max-height: 150px;
        `;
        newTagWrapper.appendChild(suggestions);

        const newTagConfirmButton = document.createElement('button');
        newTagConfirmButton.textContent = 'Add Tag';
        newTagConfirmButton.className = 'btn btn-primary btn-sm';
        newTagConfirmButton.style.cssText = 'align-self: center; margin-top: 10px;';
        newTagWrapper.appendChild(newTagConfirmButton);

        newTagInput.addEventListener(
            'input',
            debounce(async () => {
                const tagName = newTagInput.value.trim();
                if (!tagName) {
                    suggestions.innerHTML = '';
                    return;
                }

                const tags = await queryTags(tagName);
                suggestions.innerHTML = ''; // Clear old suggestions

                tags.forEach(tag => {
                    const li = document.createElement('li');
                    li.textContent = tag.name;
                    li.style.cssText = `
                        padding: 5px 10px;
                        cursor: pointer;
                        border-bottom: 1px solid #ccc;
                    `;
                    li.addEventListener('click', () => {
                        newTagInput.value = tag.name;
                        suggestions.innerHTML = ''; // Clear suggestions
                    });
                    suggestions.appendChild(li);
                });
            }, 300)
        );

        newTagConfirmButton.addEventListener('click', () => {
            const tagName = newTagInput.value.trim();
            if (tagName && !storedTagColors[tagName]) {
                storedTagColors[tagName] = '#ffffff';
                tagColorsContent.insertBefore(createTagColorInput(tagName, '#ffffff'), newTagWrapper);
                newTagInput.value = ''; // Clear input field
                suggestions.innerHTML = ''; // Clear suggestions
                saveTagColors();
                colorizeTags();
            }
        });

        tagColorsContent.appendChild(newTagWrapper);

        // Regex Templates Section
        regexTemplatesContent.innerHTML = `<h3>Regex Templates</h3>`;

        storedRegexTemplates.forEach((template, index) => {
            regexTemplatesContent.appendChild(createRegexTemplateInput(template, index));
        });

        const newRegexWrapper = document.createElement('div');
        newRegexWrapper.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: start;
            margin-top: 10px;
        `;

        const newRegexInput = document.createElement('input');
        newRegexInput.type = 'text';
        newRegexInput.placeholder = 'New Regex Pattern';
        newRegexInput.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 5px;';
        newRegexWrapper.appendChild(newRegexInput);

        const cssTemplateSelect = document.createElement('select');
        cssTemplateSelect.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 5px;';
        Object.keys(storedCssTemplates).forEach(templateName => {
            const option = document.createElement('option');
            option.value = templateName;
            option.textContent = templateName;
            cssTemplateSelect.appendChild(option);
        });
        newRegexWrapper.appendChild(cssTemplateSelect);

        const newRegexConfirmButton = document.createElement('button');
        newRegexConfirmButton.textContent = 'Add Regex Template';
        newRegexConfirmButton.className = 'btn btn-primary btn-sm';
        newRegexConfirmButton.style.cssText = 'align-self: center; margin-top: 10px;';
        newRegexWrapper.appendChild(newRegexConfirmButton);

        newRegexConfirmButton.addEventListener('click', () => {
            const pattern = newRegexInput.value.trim();
            const cssTemplateName = cssTemplateSelect.value;
            if (pattern && cssTemplateName) {
                const newTemplate = { pattern, cssTemplateName };
                storedRegexTemplates.push(newTemplate);
                regexTemplatesContent.insertBefore(createRegexTemplateInput(newTemplate, storedRegexTemplates.length - 1), newRegexWrapper);
                newRegexInput.value = ''; // Clear input field
                saveRegexTemplates();
                colorizeTags();
            }
        });

        regexTemplatesContent.appendChild(newRegexWrapper);

        // CSS Templates Section
        cssTemplatesContent.innerHTML = `<h3>CSS Templates</h3>`;

        Object.entries(storedCssTemplates).forEach(([templateName, cssProperties]) => {
            cssTemplatesContent.appendChild(createCssTemplateInput(templateName, cssProperties));
        });

        const newCssTemplateWrapper = document.createElement('div');
        newCssTemplateWrapper.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: start;
            margin-top: 10px;
        `;

        const newCssTemplateNameInput = document.createElement('input');
        newCssTemplateNameInput.type = 'text';
        newCssTemplateNameInput.placeholder = 'New CSS Template Name';
        newCssTemplateNameInput.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 5px;';
        newCssTemplateWrapper.appendChild(newCssTemplateNameInput);

        const newCssTemplateTextarea = document.createElement('textarea');
        newCssTemplateTextarea.placeholder = 'CSS Properties (JSON format)';
        newCssTemplateTextarea.style.cssText = 'width: 100%; height: 100px; margin-bottom: 10px; padding: 5px;';
        newCssTemplateWrapper.appendChild(newCssTemplateTextarea);

        const newCssTemplateConfirmButton = document.createElement('button');
        newCssTemplateConfirmButton.textContent = 'Add CSS Template';
        newCssTemplateConfirmButton.className = 'btn btn-primary btn-sm';
        newCssTemplateConfirmButton.style.cssText = 'align-self: center; margin-top: 10px;';
        newCssTemplateWrapper.appendChild(newCssTemplateConfirmButton);

        newCssTemplateConfirmButton.addEventListener('click', () => {
            const templateName = newCssTemplateNameInput.value.trim();
            let cssProperties;
            try {
                cssProperties = JSON.parse(newCssTemplateTextarea.value);
            } catch (e) {
                alert('Invalid CSS properties JSON');
                return;
            }
            if (templateName && cssProperties) {
                storedCssTemplates[templateName] = cssProperties;
                cssTemplatesContent.insertBefore(createCssTemplateInput(templateName, cssProperties), newCssTemplateWrapper);
                newCssTemplateNameInput.value = ''; // Clear input field
                newCssTemplateTextarea.value = '';
                saveCssTemplates();
                colorizeTags();
            }
        });

        cssTemplatesContent.appendChild(newCssTemplateWrapper);

        // Append all contents to modal
        modal.appendChild(tagColorsContent);
        modal.appendChild(regexTemplatesContent);
        modal.appendChild(cssTemplatesContent);

        // Export and Import Buttons
        const buttonWrapper = document.createElement('div');
        buttonWrapper.style.cssText = `
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
        `;

        const exportButton = document.createElement('button');
        exportButton.textContent = 'Export to JSON';
        exportButton.className = 'btn btn-secondary';
        exportButton.addEventListener('click', exportTagColors);

        const importButton = document.createElement('button');
        importButton.textContent = 'Import from JSON';
        importButton.className = 'btn btn-secondary';
        importButton.addEventListener('click', importTagColors);

        buttonWrapper.appendChild(exportButton);
        buttonWrapper.appendChild(importButton);
        modal.appendChild(buttonWrapper);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    };

    // Create Tag Color Input
    const createTagColorInput = (tagName, color) => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        `;

        const label = document.createElement('span');
        label.textContent = tagName;
        label.style.cssText = 'flex: 1;';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = color;
        colorInput.style.cssText = 'margin-left: 10px; margin-right: 10px;';
        colorInput.addEventListener('input', () => {
            storedTagColors[tagName] = colorInput.value;
            saveTagColors();
            colorizeTags();
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Remove';
        deleteButton.className = 'btn btn-danger btn-sm';
        deleteButton.style.marginLeft = '10px';
        deleteButton.addEventListener('click', () => {
            delete storedTagColors[tagName];
            saveTagColors();
            wrapper.remove();
            colorizeTags();
        });

        wrapper.appendChild(label);
        wrapper.appendChild(colorInput);
        wrapper.appendChild(deleteButton);
        return wrapper;
    };

   const createRegexTemplateInput = (template, index) => {
		const wrapper = document.createElement('div');
		wrapper.style.cssText = `
			display: flex;
			align-items: center;
			margin-bottom: 10px;
		`;
	
		const regexInput = document.createElement('input');
		regexInput.type = 'text';
		regexInput.value = template.pattern;
		regexInput.style.cssText = 'flex: 1; margin-right: 10px;';
		regexInput.addEventListener('input', () => {
			storedRegexTemplates[index].pattern = regexInput.value;
			saveRegexTemplates();
			colorizeTags();
		});
	
		const cssTemplateSelect = document.createElement('select');
		cssTemplateSelect.style.cssText = `
			margin-right: 10px;
			color: white; /* Text color */
			background-color: black; /* Dropdown background */
			border: 1px solid #ccc;
			padding: 5px;
			border-radius: 5px;
			appearance: none; /* For consistent styling across browsers */
		`;
		Object.keys(storedCssTemplates).forEach(templateName => {
			const option = document.createElement('option');
			option.value = templateName;
			option.textContent = templateName;
			if (templateName === template.cssTemplateName) {
				option.selected = true;
			}
			cssTemplateSelect.appendChild(option);
		});
		cssTemplateSelect.addEventListener('change', () => {
			storedRegexTemplates[index].cssTemplateName = cssTemplateSelect.value;
			saveRegexTemplates();
			colorizeTags();
		});
	
		const deleteButton = document.createElement('button');
		deleteButton.textContent = 'Remove';
		deleteButton.className = 'btn btn-danger btn-sm';
		deleteButton.addEventListener('click', () => {
			storedRegexTemplates.splice(index, 1);
			saveRegexTemplates();
			wrapper.remove();
			colorizeTags();
		});
	
		wrapper.appendChild(regexInput);
		wrapper.appendChild(cssTemplateSelect);
		wrapper.appendChild(deleteButton);
	
		return wrapper;
	};

    // Create CSS Template Input
    const createCssTemplateInput = (templateName, cssProperties) => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            margin-bottom: 20px;
        `;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = templateName;
        nameInput.style.cssText = 'width: 100%; margin-bottom: 5px; padding: 5px;';
        nameInput.addEventListener('input', () => {
            const newName = nameInput.value.trim();
            if (newName && newName !== templateName) {
                storedCssTemplates[newName] = storedCssTemplates[templateName];
                delete storedCssTemplates[templateName];
                saveCssTemplates();
                templateName = newName;
                colorizeTags();
            }
        });

        const cssTextarea = document.createElement('textarea');
        cssTextarea.value = JSON.stringify(cssProperties, null, 4);
        cssTextarea.style.cssText = 'width: 100%; height: 100px; margin-bottom: 5px; padding: 5px;';
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
    };

    // Export and Import Functions
    const exportTagColors = () => {
        const data = {
            tagColors: storedTagColors,
            regexTemplates: storedRegexTemplates,
            cssTemplates: storedCssTemplates,
        };
        const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'stashCustomTagColors.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log("Exported data to stashCustomTagColors.json");
    };

    const importTagColors = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (importedData.tagColors) {
                        Object.assign(storedTagColors, importedData.tagColors);
                        saveTagColors();
                    }
                    if (importedData.regexTemplates) {
                        storedRegexTemplates.length = 0; // Clear existing
                        storedRegexTemplates.push(...importedData.regexTemplates);
                        saveRegexTemplates();
                    }
                    if (importedData.cssTemplates) {
                        Object.assign(storedCssTemplates, importedData.cssTemplates);
                        saveCssTemplates();
                    }
                    colorizeTags();
                    console.log("Imported data from JSON file:", importedData);
                    alert("Import successful! Please reopen the Tag Manager to see changes.");
                } catch (error) {
                    console.error("Error importing JSON file:", error);
                    alert("Failed to import data. Please ensure the file is a valid JSON.");
                }
            };
            reader.readAsText(file);
        });

        input.click();
    };

    // Create Tag Manager Button
	const createTagManagerButton = (target) => {
		if (document.getElementById('tag-manager-button')) return;
	
		const button = document.createElement('button');
		button.id = 'tag-manager-button';
		button.type = 'button';
		button.className = 'btn btn-secondary';
		button.style.cssText = 'margin-left: 8px; display: flex; align-items: center;';
	
		button.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" style="width: 1.2em; height: 1.2em; margin-right: 5px;">
				<path fill="white" d="M0 64C0 28.7 28.7 0 64 0L352 0c35.3 0 64 28.7 64 64l0 64c0 35.3-28.7 64-64 64L64 192c-35.3 0-64-28.7-64-64L0 64zM160 352c0-17.7 14.3-32 32-32l0-16c0-44.2 35.8-80 80-80l144 0c17.7 0 32-14.3 32-32l0-32 0-90.5c37.3 13.2 64 48.7 64 90.5l0 32c0 53-43 96-96 96l-144 0c-8.8 0-16 7.2-16 16l0 16c17.7 0 32 14.3 32 32l0 128c0 17.7-14.3 32-32 32l-64 0c-17.7 0-32-14.3-32-32l0-128z"/>
			</svg>
			
		`;
	
		button.addEventListener('click', openTagManagerModal);
		target.appendChild(button);
		console.log("Tag Manager button added.");
	};

    // Observe Navbar to add Tag Manager Button
    const observerNavbar = new MutationObserver(() => {
        const navbar = document.querySelector('.navbar-buttons');
        if (navbar) {
            createTagManagerButton(navbar);
            observerNavbar.disconnect();
        }
    });
    observerNavbar.observe(document.body, { childList: true, subtree: true });

    // Initial tag colorization
    colorizeTags();
})();
