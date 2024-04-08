# Serechops-Stash

An Index page for all Stash related plugins. Please add this index as a new source in Stash: https://serechops.github.io/Serechops-Stash/index.yml

# Renamer

The [Renamer](https://github.com/Serechops/Serechops-Stash/tree/main/plugins/Renamer#renamer) plugin is very similar to renameOnUpdate. It will automatically rename files based on user-defined settings whenever a scene is updated.

# Find Marker Tag Images: 

A script that will compare the names of your tag images and scene markers and update the animated previews of any matched scene markers to be your tag images. 
As long as you have generated your scene marker animated previews, you now have a way to easily mass update and animate your tag images. 
Enjoy!

# Performer Gallery Scraper:

To run this script, you need to have Node.js installed on your machine. If you don't have it yet, you can download and install it from the official Node.js website: https://nodejs.org/en/download/current

Once you install the plugin via the plugin manager, navigate to your plugins/Performer Gallery Scraper directory and open a terminal. 

Run the command `npm install` within this directory to install all the required dependencies for this plugin to work.

Navigate to the `Settings > Tasks` page and run the `Performer Gallery Scraper Plugin > Scrape Performers` task. **This may take a while depending on the number of performers you have in your Stash. It is recommended to run this overnight.**

The final result will be a `Galleries` folder created with all of the performer zips inside. This will be located in your main Stash server folder as it gets created from where the script is being triggered, which in this case, is by the Stash process itself.

Enjoy!
