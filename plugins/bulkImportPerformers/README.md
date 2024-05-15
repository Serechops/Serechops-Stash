# Bulk Import Performers

## Description

This script bulk imports performers into your system using a list of performer names from a text file.

## Features

- Reads performer names from a text file.
- Checks if a performer already exists before creating a new one.
- Logs detailed information about the process, including successes and errors.

## Requirements

`pip install stashapp-tools`

## Usage

1. Run the Task `Bulk Import Performers` after adding their names to the `performers.txt`

`Note:` for any new additions to the list, you will have to `Reload Plugins` for the script to see the updated list.

## Example

Here is an example of what the `performers.txt` file should look like:

Vida Guerra

Kate Upton

Katy Perry

Jessica Alba

## Logging

The script uses `stashapi.log` for logging. It logs detailed information about each performer processed, including whether they were created or already exist.

## Troubleshooting

If you encounter any issues:
- Ensure your `config.py` file has the correct API key and endpoint.
- Ensure your `performers.txt` file is correctly formatted and located in the same directory as the script.

