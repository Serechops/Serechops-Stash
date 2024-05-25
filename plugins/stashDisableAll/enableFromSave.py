import os
import requests
import json
import stashapi.log as log

# GraphQL endpoint
url = "http://localhost:9999/graphql"

# GraphQL mutation to set plugins enabled/disabled
mutation_enable = """
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

# GraphQL mutation to configure interface options
mutation_enable_interface = """
mutation ConfigureInterface {
    configureInterface(
        input: {
            cssEnabled: true
            javascriptEnabled: true
            customLocalesEnabled: true
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

# Determine the script directory
script_dir = os.path.dirname(os.path.abspath(__file__))

# Load the saved state from the JSON file
json_file_path = os.path.join(script_dir, 'enabled_plugins.json')
with open(json_file_path, 'r') as f:
    saved_state = json.load(f)
enabled_plugins = saved_state['enabled_plugins']
interface_config = saved_state['interface_config']
log.info(f"Loaded enabled plugins state from '{json_file_path}': {enabled_plugins}")
log.info(f"Loaded interface configuration state from '{json_file_path}': {interface_config}")

# Execute the mutation to re-enable the plugins
variables = {'booleanMap': enabled_plugins}
graphql_request(mutation_enable, variables)
log.info("Plugins have been re-enabled based on the saved state in 'enabled_plugins.json'.")

# Execute the mutation to re-enable the interface options based on the saved state
mutation_enable_interface_dynamic = f"""
mutation ConfigureInterface {{
    configureInterface(
        input: {{
            cssEnabled: {str(interface_config['cssEnabled']).lower()}
            javascriptEnabled: {str(interface_config['javascriptEnabled']).lower()}
            customLocalesEnabled: {str(interface_config['customLocalesEnabled']).lower()}
        }}
    ) {{
        cssEnabled
        javascriptEnabled
        customLocalesEnabled
    }}
}}
"""
graphql_request(mutation_enable_interface_dynamic)
log.info("Interface options have been re-enabled based on the saved state.")

# Execute the mutation to reload the plugins
graphql_request(mutation_reload)
log.info("Plugins have been reloaded to refresh their state.")
