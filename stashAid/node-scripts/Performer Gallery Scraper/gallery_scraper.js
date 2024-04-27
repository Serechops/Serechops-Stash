const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

// Function to download image by URL
const downloadImage = (url, filePath) => new Promise((resolve, reject) => {
  try {
    const parsedUrl = new URL(url);
    https.get(parsedUrl, (res) => {
      if (res.statusCode === 200) {
        console.log(`Downloading image: ${url}`);
        const stream = fs.createWriteStream(filePath);
        res.pipe(stream);
        stream.on('finish', () => stream.close(() => resolve(filePath)));
        stream.on('error', (streamError) => {
          console.log(`Stream error while downloading image: ${streamError.message}`);
          reject(streamError);
        });
      } else {
        console.log(`Failed to download image: ${url} - Status Code: ${res.statusCode}`);
        reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
      }
    }).on('error', (e) => {
      console.log(`HTTPS error while downloading image: ${e.message}`);
      reject(e);
    });
  } catch (e) {
    console.log(`Invalid URL: ${url} - ${e.message}`);
    reject(e);
  }
});

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: true }); // Ensure headless mode is enabled
  const page = await browser.newPage();

  try {
    const performers = await fetchPerformers();

    for (const performer of performers) {
      try {
        await processPerformer(page, performer);
      } catch (processError) {
        console.error(`Error processing performer ${performer.name}: ${processError.message}`);
        // Continue to the next performer despite the error
      }
    }
  } catch (e) {
    console.error(`An error occurred: ${e.message}`);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
})();

async function fetchPerformers() {
  const graphqlServerUrl = 'http://localhost:9999/graphql';
  const queryAllPerformers = `
    query AllPerformers {
      allPerformers {
        name
        id
      }
    }
  `;

  try {
    const response = await axios.post(graphqlServerUrl, {
      query: queryAllPerformers,
    });
    const allPerformers = response.data.data.allPerformers;

    // Get the list of existing .zip archives in the Galleries directory
    const galleriesDirectory = './Galleries';
    let existingArchives = [];
    if (fs.existsSync(galleriesDirectory)) {
      existingArchives = fs.readdirSync(galleriesDirectory).filter(file => path.extname(file).toLowerCase() === '.zip').map(file => file.replace('.zip', ''));
    }

    // Filter out performers whose zip archives already exist
    const newPerformers = allPerformers.filter(performer => {
      const formattedName = performer.name.replace(/\s+/g, '-').toLowerCase();
      return !existingArchives.includes(formattedName);
    });

    return newPerformers;
  } catch (error) {
    console.error(`Failed to fetch performers: ${error.message}`);
    return []; // Return an empty array to avoid breaking the script
  }
}

const archiver = require('archiver');

async function processPerformer(page, performer) {
  const inputName = performer.name;
  const formattedName = inputName.replace(/\s+/g, '-').toLowerCase();
  const baseUrl = 'https://www.porngals4.com';
  const performerUrl = `${baseUrl}/${formattedName}/solo`;

  console.log(`Scraping up to 5 pages of solo galleries for: ${inputName}`);
  const performerDirectory = `./${inputName}`;
  const galleriesDirectory = `./Galleries`;

  if (!fs.existsSync(galleriesDirectory)) {
    fs.mkdirSync(galleriesDirectory);
  }

  if (!fs.existsSync(performerDirectory)) {
    fs.mkdirSync(performerDirectory, { recursive: true });
  }

  try {
    console.log(`Visiting performer's page: ${performerUrl}`);
    await page.goto(performerUrl, { waitUntil: 'networkidle2' });
    const galleryUrls = await page.$$eval('div.item a', links => links.map(a => a.href));

    // Filter gallery URLs to only those containing the performer's name in the URL
    const filteredGalleryUrls = galleryUrls.filter(url => url.includes(formattedName));

    // If no gallery URLs contain the performer's name, skip processing this performer
    if (filteredGalleryUrls.length === 0) {
      console.log(`No galleries found with performer's name: ${inputName}. Skipping performer.`);
      fs.rmdirSync(performerDirectory, { recursive: true });
      return;
    }

    console.log(`Found gallery URLs with performer's name: ${filteredGalleryUrls}`); // Log the filtered gallery URLs

    for (const url of filteredGalleryUrls) {
      try {
        console.log(`Processing gallery: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2' });
        const imageUrls = await page.$$eval('div.gal a', anchors => anchors.map(a => a.href));

        for (const imageUrl of imageUrls) {
          try {
            if (imageUrl.includes(formattedName)) {
              const imageName = path.basename(new URL(imageUrl).pathname);
              const imagePath = path.join(performerDirectory, imageName);
              await downloadImage(imageUrl, imagePath);
            }
          } catch (downloadError) {
            console.log(`Error downloading image: ${downloadError.message}`);
            // Continue to the next image despite the error
          }
        }
      } catch (galleryError) {
        console.log(`Error processing gallery: ${url} - ${galleryError.message}`);
        // Continue to the next gallery despite the error
      }
    }
  } catch (error) {
    console.log(`Error visiting performer's page: ${performerUrl} - ${error.message}`);
  }

  // Create a zip archive for the performer directory
  const outputZipPath = path.join(galleriesDirectory, `${inputName}.zip`);
  const outputZipStream = fs.createWriteStream(outputZipPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Set compression level to maximum
  });
  
  outputZipStream.on('close', () => {
    console.log(`Zip archive created for ${inputName}: ${outputZipPath}`);
    // Remove individual image files and the related performer subdir after creating the zip archive
    fs.readdirSync(performerDirectory).forEach(file => {
      const filePath = path.join(performerDirectory, file);
      fs.unlinkSync(filePath);
    });
    fs.rmdirSync(performerDirectory, { recursive: true });
  });

  archive.pipe(outputZipStream);
  archive.directory(performerDirectory, false); // Add the performer directory to the zip archive
  archive.finalize();

  console.log(`Finished processing ${inputName}`);
}