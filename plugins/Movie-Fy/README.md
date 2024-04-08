# Movie-Fy

## Instructions

1. **Install Dependencies**: Ensure to install thefuzz library by running `pip install thefuzz`, as it is required for fuzzy string matching.

2. **Installation**: Copy the entire contents of the Movie-Fy folder into your plugins directory and then 'Reload Your Plugins'.

3. **Setup 'Movie' Studio**: Start by selecting the 'Movie-Fy Create Movie Studio' task in the 'Tasks' section. This will create the 'Movie' studio within your Stash, acting as a container for managing movie scenes.

4. **Load Movie Scenes**: Load your movie scenes into your Stash. If they are already present, bulk update your scenes studio to be the 'Movie' studio. If you have new scenes that you are importing directly into Stash for the first time, you will need to run an additional step to ensure Movie-Fy can see your scenes. Since Movie-Fy looks for scene titles and matches those against the local 'Movie-Fy URLs.json' to be able to pull URLs for scraping and appending the proper metadata to your movies, you will need to go to the 'Tasks' section again, and select the 'Movie-Fy Check and Update Scene Titles' task. All this does is target any scenes within the 'Movie' studio and creates a title within Stash for them. Now, Movie-Fy should be able to see your scenes and start managing them.

5. **Run Movie-fy Script**: Launch the main Movie-Fy.py script by opening a terminal in your plugins folder and running `python Movie-Fy.py`. Follow the on-screen prompts to match scene titles to movies, create new movies, or add scenes to existing movies.

6. **Bulk Scraping**: After creating movies, run the 'Movie-Fy Bulk Movie Scraper' task to scrape URLs added to movie containers and update movie metadata.

7. **Update Scene Covers**: Optionally, update scene preview images to match movie covers by running the 'Movie-Fy Update Movie Scene Covers' task.

8. **Review Movies and Studios**: Manually review newly created movies and attach proper studios to them. Use the 'Movie-Fy Scene Studio Bulk Update' task to automatically update scenes with the same studio as the movie.

## Support

For any questions or assistance, feel free to reach out in the Stash Discord community.

## Tips

Start with a few movies to understand the workflow before bulk updating your movie collection into Stash.

To give Movie-Fy the best chances of finding a match, clean up your file names/scene titles first! ie. awesome-scene-title-15-scene4(1999) --> Awesome Scene Title 15 - Scene 4

Enjoy organizing your movies with Movie-Fy!
