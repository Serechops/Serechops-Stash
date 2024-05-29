import os
import requests
import json
import stashapi.log as log

# GraphQL endpoint
url = "http://localhost:9999/graphql"

# GraphQL query to get all plugins
query_plugins = """
query Plugins {
    plugins {
        id
        name
        description
        url
        version
        enabled
        requires
    }
}
"""

# GraphQL query to get current interface configuration
query_interface_config = """
query Configuration {
    configuration {
        interface {
            cssEnabled
            javascriptEnabled
            customLocalesEnabled
        }
    }
}
"""

# GraphQL mutation to set plugins enabled/disabled
mutation_disable = """
mutation SetPluginsEnabled($booleanMap: BoolMap!) {
    setPluginsEnabled(enabledMap: $booleanMap)
}
"""

# GraphQL mutation to reload plugins
mutation_reload = """
mutation ReloadPlugins {
    reloadPlugins
}
"""

# GraphQL mutation to disable all interface options
mutation_disable_interface = """
mutation ConfigureInterface {
    configureInterface(
        input: {
            cssEnabled: false
            javascriptEnabled: false
            customLocalesEnabled: false
        }
    ) {
        cssEnabled
        javascriptEnabled
        customLocalesEnabled
    }
}
"""

# Function to execute a GraphQL request
def graphql_request(query, variables=None):
    response = requests.post(url, json={'query': query, 'variables': variables})
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"GraphQL query failed with status code {response.status_code}: {response.text}")

# Query to get the current plugins and their enabled state
plugins_data = graphql_request(query_plugins)

# Extract the plugins that are enabled, excluding 'stashEnableFromSave'
enabled_plugins = {plugin['id']: plugin['enabled'] for plugin in plugins_data['data']['plugins'] if plugin['enabled'] and plugin['id'] != "stashEnableFromSave"}
log.info(f"Enabled plugins detected: {enabled_plugins}")

# Query to get the current interface configuration
interface_config_data = graphql_request(query_interface_config)
interface_config = interface_config_data['data']['configuration']['interface']
log.info(f"Current interface configuration: {interface_config}")

# Determine the script directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# Save the current state to a JSON file in the script directory
json_file_path = os.path.join(script_dir, 'enabled_plugins.json')
with open(json_file_path, 'w') as f:
    json.dump({
        'enabled_plugins': enabled_plugins,
        'interface_config': interface_config
    }, f, indent=4)
log.info(f"Enabled plugins and interface configuration state has been saved to '{json_file_path}'.")

# Create a map to disable all enabled plugins, excluding 'stashEnableFromSave'
disable_map = {plugin_id: False for plugin_id in enabled_plugins}

# Execute the mutation to disable the plugins
variables = {'booleanMap': disable_map}
graphql_request(mutation_disable, variables)
log.info("All enabled plugins have been disabled, excluding 'stashEnableFromSave'.")

# Execute the mutation to disable all interface options
graphql_request(mutation_disable_interface)
log.info("All interface options have been disabled.")

# Execute the mutation to reload the plugins
graphql_request(mutation_reload)
log.info("Plugins have been reloaded to refresh their state.")
