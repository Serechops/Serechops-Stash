# studioTopPerformer

`studioTopPerformer` enhances studio cards by displaying the top performers for each studio. The top performers are identified based on the number of scenes they have appeared in, and their names are displayed with a gold "queen" icon and a hyperlink to the performer's page.

## Features

- Automatically fetches top performers for each studio.
- Displays top performers with a queen icon and a hyperlink to their scenes.

## User Configuration

You can configure the script to point to your specific Stash server by adjusting the following variables:

```javascript
const userConfig = {
    scheme: 'http', // 'http' or 'https'
    host: 'localhost', // Your server IP or hostname
    port: 9999, // Your server port
    apiKey: '', // Your API key for the Stash server (optional)
};
