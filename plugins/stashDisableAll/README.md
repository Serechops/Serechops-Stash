# Stash Disable All Plugin

This repository contains two Python scripts to manage the state of plugins and interface configuration options in a system using GraphQL. The primary script disables all enabled plugins (except the `stashEnableAll` plugin) and interface options, saving their states to a JSON file. The secondary script re-enables them based on the saved state.

## Scripts

- `disable_plugins_and_interface.py`: Disables all enabled plugins and interface options, saving their state to `enabled_plugins.json`.
- `enable_plugins_and_interface.py`: Re-enables plugins and interface options based on the saved state in `enabled_plugins.json`.

## Script Details

`disable_plugins_and_interface.py`

This script performs the following actions:

- Queries the current state of all plugins and interface configuration options.
- Saves the states of enabled plugins and interface options to enabled_plugins.json in the script directory.
- Disables all enabled plugins except the one with the ID stashEnableFromSave.
- Disables all interface options.
- Reloads the plugin configurations.

`enable_plugins_and_interface.py`

This script performs the following actions:

- Loads the saved state of plugins and interface options from enabled_plugins.json.
- Re-enables the plugins based on the saved state.
- Re-enables the interface options based on the saved state.
- Reloads the plugin configurations.
