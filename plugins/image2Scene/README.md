# image2Scene

This script is designed to link images to galleries ti scenes dynamically. It includes an autocomplete search feature for scenes, and the ability to create and update galleries based on image data.

## Features

- Autocomplete search field for scenes with image previews
- Dynamic linking of images to scenes via auto created galleries

## Config

```
const serverConfig = {
  scheme: 'http', // or 'https'
  host: 'localhost',
  port: '9999',
  apiKey: '', // Add your API key here if applicable
};
```

## Explanation

In the `Image Edit Panel` you should see a new `Scenes` field, akin to the `Gallery Edit Panel`. From here, you can select a scene by typing its name and click `Link Scene` to have a gallery auto-created and named after the image, and then have that newly created gallery linked to the selected scene.
