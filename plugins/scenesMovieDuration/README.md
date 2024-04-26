# Movie Duration from Scenes

This script updates the duration of movies in your Stash by summing the durations of their scenes.

## Description

When managing movies in your database scenes are added, removed, or edited, and the movie duration may become outdated. This script solves that problem by recalculating the movie duration based on the sum of durations of its scenes.

## How to Use

1. Ensure you have Python installed on your system.
2. Modify the `scenesMovieDuration.py` script to connect to your database and GraphQL endpoint. **Default is localhost:9999/graphql**
3. Run the task `Update Movie Durations` to update all your movie durations to accurately reflect the sum of their total scenes' durations.

