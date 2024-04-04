# Serechoo-Stash
An Index page for all Stash related plugins.

# Renamer:

### Requirements

`pip install stashapp-tools`
`pip install pyYAML`

### Using Renamer 
`*Note: All changes are made when a Scene is updated and saved. Start small, make sure you get the changes you want in place first, then Rename away!`

When you have installed the `Renamer` plugin, hop into your plugins directory, Renamer folder > open settings.yml with your favorite code/text editor and you'll see this:

```# Define wrapper styles for different parts of the filename.
# Use '[]' for square brackets, '{}' for curly brackets, '()' for parentheses, or an empty string for None.

# Modify these values to change how each part of the filename is wrapped.
wrapper_styles:
  studio: '[]'  # Define how the studio name should be wrapped. Use '[]' for square brackets, '{}' for curly brackets, '()' for parentheses, or an empty string for None.
  title: '[]'   # Define how the title should be wrapped. Use '[]' for square brackets, '{}' for curly brackets, '()' for parentheses, or an empty string for None.
  performers: '[]'  # Define how the performers should be wrapped. Use '[]' for square brackets, '{}' for curly brackets, '()' for parentheses, or an empty string for None.
  date: '[]'    # Define how the date should be wrapped. Use '[]' for square brackets, '{}' for curly brackets, '()' for parentheses, or an empty string for None.

# Define the separator to use between different parts of the filename.
# Use '-' for hyphen, '_' for underscore, or ' ' for space.

# Modify this value to change the separator between parts of the filename.
separator: '-'  # Define the separator to use between different parts of the filename. Use '-' for hyphen, '_' for underscore, or ' ' for space.

# Define the order of keys in the filename.
# Use a list to specify the order of keys.
# Valid keys are 'studio', 'title', 'performers', and 'date'.
#Example change of key_order would be:
#keyorder:
# - studio
# - title
# - date
# - performers

# Modify the order as needed to change the key order in the filename.
key_order:
  - studio
  - title
  - performers
  - date

# Define whether files should be moved when renaming
move_files: false
```

The first section describes how you want the studio, title, performers, and date of the filename wrapped. By default, your filenames will look like this when renamed:

`[Studio]-[Title]-[Performers]-[Date].extension`

Change the wrapper denoted in the single quotes:

`ie. studio '[]' can be changed to studio '()' and same goes for each key`

The next section involves the order of how that filename is structured:

### Modify the order as needed to change the key order in the filename.
key_order:
  - studio
  - title
  - performers
  - date

You can change the order of this list however you see fit, for example:
### Modify the order as needed to change the key order in the filename.
key_order:
  - title
  - studio
  - date
  - performers

Finally, the `move-files` is set to false by default. If you set this to true, in the current iteration, it will create a new directory based on the studio name within the current parent directory of wherever your scene is located.

`ie. C:\Stash_Server\Videos\Myscene.mp4 renamed and moved to --> C:\Stash_Server\Studio of Scene\[Studio of Scene]-[Title of Scene]-[Performers]-[Date].mp4`

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
