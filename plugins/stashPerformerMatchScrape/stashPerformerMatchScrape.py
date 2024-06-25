import requests
import stashapi.log as log
from datetime import datetime
import time
import json
import sys

# Configuration
config = {
    'scheme': 'http',
    'host': 'localhost',
    'port': 9999,
    'api_key': '',  # Your Stash API key
    'tpdb_api_key': '',  # Your TPDB API key
    'stashdb_api_key': '',  # Your stashDB API key
}

# Build API URLs
local_api_url = f"{config['scheme']}://{config['host']}:{config['port']}/graphql"
tpdb_api_url = "https://theporndb.net/graphql"
stashdb_api_url = "https://stashdb.org/graphql"

# GraphQL queries and mutations
local_find_performer_query = """
query FindLocalPerformer($id: ID!) {
    findPerformer(id: $id) {
        id
        name
        stash_ids {
            endpoint
            stash_id
        }
    }
}
"""

all_performers_query = """
query AllPerformers {
    allPerformers {
        id
        name
        stash_ids {
            endpoint
            stash_id
        }
    }
}
"""

search_performer_query = """
query SearchPerformer($term: String!) {
    searchPerformer(term: $term) {
        id
        name
    }
}
"""

find_performer_query_tpdb = """
query FindPerformer($id: ID!) {
    findPerformer(id: $id) {
        id
        name
        disambiguation
        aliases
        gender
        birth_date
        age
        ethnicity
        country
        eye_color
        hair_color
        height
        cup_size
        band_size
        waist_size
        hip_size
        breast_type
        career_start_year
        career_end_year
        deleted
        scene_count
        merged_ids
        is_favorite
        created
        updated
        images {
            id
            url
        }
    }
}
"""

find_performer_query_stashdb = """
query FindPerformer($id: ID!) {
    findPerformer(id: $id) {
        id
        name
        disambiguation
        aliases
        gender
        birth_date
        age
        ethnicity
        country
        eye_color
        hair_color
        height
        cup_size
        band_size
        waist_size
        hip_size
        breast_type
        career_start_year
        career_end_year
        deleted
        scene_count
        merged_ids
        is_favorite
        created
        updated
        images {
            id
            url
        }
    }
}
"""

performer_update_mutation = """
mutation PerformerUpdate($input: PerformerUpdateInput!) {
    performerUpdate(input: $input) {
        id
        name
    }
}
"""

# Functions
def graphql_request(query, variables, endpoint, api_key, retries=5):
    headers = {'Content-Type': 'application/json'}
    if api_key:
        headers['Apikey'] = api_key
    for attempt in range(retries):
        try:
            response = requests.post(endpoint, json={'query': query, 'variables': variables}, headers=headers)
            response.raise_for_status()
            response_json = response.json()
            if 'errors' in response_json:
                log.error(f"GraphQL request returned errors: {response_json['errors']}")
                return None
            return response_json.get('data')
        except requests.exceptions.RequestException as e:
            log.error(f"GraphQL request failed (attempt {attempt + 1} of {retries}): {e}")
            if attempt < retries - 1:
                sleep_time = 2 ** attempt
                log.info(f"Retrying in {sleep_time} seconds...")
                time.sleep(sleep_time)
            else:
                log.error("Max retries reached. Giving up.")
                raise

def find_local_performer(performer_id):
    response = graphql_request(local_find_performer_query, {'id': performer_id}, local_api_url, config['api_key'])
    if response:
        return response.get('findPerformer')
    return None

def get_all_performers():
    response = graphql_request(all_performers_query, {}, local_api_url, config['api_key'])
    if response:
        return response.get('allPerformers')
    return []

def search_performer(term, api_url, api_key):
    response = graphql_request(search_performer_query, {'term': term}, api_url, api_key)
    if response:
        return response.get('searchPerformer')
    return None

def find_performer(tpdb_id, api_url, api_key):
    if "theporndb.net" in api_url:
        response = graphql_request(find_performer_query_tpdb, {'id': tpdb_id}, api_url, api_key)
    else:
        response = graphql_request(find_performer_query_stashdb, {'id': tpdb_id}, api_url, api_key)
    if response:
        return response.get('findPerformer')
    return None

def update_performer(performer_data, local_id):
    performer_data['id'] = local_id

    # Convert date to string
    if isinstance(performer_data['birthdate'], datetime):
        performer_data['birthdate'] = performer_data['birthdate'].strftime('%Y-%m-%d')

    variables = {'input': performer_data}

    response = graphql_request(performer_update_mutation, variables, local_api_url, config['api_key'])
    if response:
        return response.get('performerUpdate')
    return None

def parse_birthdate(date_str):
    if date_str:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            try:
                return datetime.strptime(date_str, '%Y').date()
            except ValueError:
                return None
    return None

def update_performer_data(performer):
    log.info(f"Processing performer: {performer['name']} (ID: {performer['id']})")

    # Check if the performer already has a TPDB or stashDB stash ID
    has_tpdb_id = any(stash['endpoint'] == 'https://theporndb.net/graphql' for stash in performer['stash_ids'])
    has_stashdb_id = any(stash['endpoint'] == 'https://stashdb.org/graphql' for stash in performer['stash_ids'])

    tpdb_match = None
    stashdb_match = None

    if not has_tpdb_id:
        tpdb_results = search_performer(performer['name'], tpdb_api_url, config['tpdb_api_key'])
        if tpdb_results:
            exact_matches = [result for result in tpdb_results if result['name'].lower() == performer['name'].lower()]

            if len(exact_matches) == 1:
                tpdb_match = exact_matches[0]
            elif len(exact_matches) > 1:
                log.info(f"Skipped performer {performer['name']} due to multiple exact matches on TPDB.")
            else:
                log.info(f"No exact match found on TPDB for: {performer['name']}")

    if not has_stashdb_id:
        stashdb_results = search_performer(performer['name'], stashdb_api_url, config['stashdb_api_key'])
        if stashdb_results:
            exact_matches = [result for result in stashdb_results if result['name'].lower() == performer['name'].lower()]

            if len(exact_matches) == 1:
                stashdb_match = exact_matches[0]
            elif len(exact_matches) > 1:
                log.info(f"Skipped performer {performer['name']} due to multiple exact matches on stashDB.")
            else:
                log.info(f"No exact match found on stashDB for: {performer['name']}")

    tpdb_performer_data = find_performer(tpdb_match['id'], tpdb_api_url, config['tpdb_api_key']) if tpdb_match else None
    stashdb_performer_data = find_performer(stashdb_match['id'], stashdb_api_url, config['stashdb_api_key']) if stashdb_match else None

    if tpdb_performer_data or stashdb_performer_data:
        # Combine data from both sources, with stashDB taking precedence if available
        combined_data = {}
        if tpdb_performer_data:
            combined_data.update(tpdb_performer_data)
        if stashdb_performer_data:
            combined_data.update(stashdb_performer_data)

        image_url = None
        if tpdb_performer_data and isinstance(tpdb_performer_data, dict):
            image_url = (tpdb_performer_data.get('images') or [{}])[0].get('url')
        if not image_url and stashdb_performer_data and isinstance(stashdb_performer_data, dict):
            image_url = (stashdb_performer_data.get('images') or [{}])[0].get('url')

        gender = combined_data.get('gender')
        if gender not in ['MALE', 'FEMALE']:
            gender = None
        alias_list = list(set(combined_data.get('aliases', [])))  # Remove duplicates
        birthdate = parse_birthdate(combined_data.get('birth_date'))

        # Add existing stash IDs
        existing_stash_ids = performer['stash_ids'] if performer['stash_ids'] else []

        # Add new stash IDs
        new_stash_ids = []
        if tpdb_match:
            new_stash_ids.append({
                'stash_id': tpdb_match['id'],
                'endpoint': "https://theporndb.net/graphql"
            })
        if stashdb_match:
            new_stash_ids.append({
                'stash_id': stashdb_match['id'],
                'endpoint': "https://stashdb.org/graphql"
            })

        # Combine existing and new stash IDs
        combined_stash_ids = existing_stash_ids + new_stash_ids

        performer_update_data = {
            'name': combined_data['name'],
            'disambiguation': combined_data.get('disambiguation'),
            'alias_list': ', '.join(alias_list),
            'gender': gender,
            'birthdate': birthdate.strftime('%Y-%m-%d') if birthdate else None,
            'ethnicity': combined_data.get('ethnicity'),
            'country': combined_data.get('country'),
            'eye_color': combined_data.get('eye_color'),
            'hair_color': combined_data.get('hair_color'),
            'height_cm': combined_data.get('height'),
            'measurements': f"{combined_data.get('cup_size', '')}{combined_data.get('band_size', '')}-{combined_data.get('waist_size', '')}-{combined_data.get('hip_size', '')}",
            'fake_tits': combined_data.get('breast_type'),
            'career_length': f"{combined_data.get('career_start_year', '')}-{combined_data.get('career_end_year', '')}" if combined_data.get('career_end_year') else f"{combined_data.get('career_start_year', '')}",
            'details': None,  # Set to None if you don't have the details field
            'death_date': None,  # Set to None if you don't have the death_date field
            'weight': None,  # Set to None if you don't have the weight field
            'twitter': None,  # Set to None if you don't have the twitter field
            'instagram': None,  # Set to None if you don't have the instagram field
            'image': image_url,
            'url': None,  # Set to None if you don't have the URL
            'tag_ids': None,  # Set to None if you don't have tag IDs
            'tattoos': None,  # Set to None if you don't have tattoo information
            'piercings': None,  # Set to None if you don't have piercing information
            'stash_ids': combined_stash_ids
        }

        log.debug(f"Prepared performer update data: {performer_update_data}")

        try:
            update_result = update_performer(performer_update_data, performer['id'])
            if update_result:
                log.info(f"Updated performer: {update_result['name']} (ID: {update_result['id']}) with new data.")
            else:
                log.info(f"No new details added for performer {performer['name']} (ID: {performer['id']}) - already up to date.")
        except requests.exceptions.HTTPError as e:
            log.error(f"Failed to update performer: {performer['name']} (ID: {performer['id']})")
            log.error(e.response.text)
    else:
        log.info(f"No new details added for performer {performer['name']} (ID: {performer['id']}) - already up to date.")

def update_all_performers():
    performers = get_all_performers()
    total_performers = len(performers)
    processed_count = 0

    for performer in performers:
        update_performer_data(performer)

        # Update progress for each performer
        processed_count += 1
        progress_percentage = processed_count / total_performers
        log.progress(progress_percentage)
        log.info(f"Processed {processed_count}/{total_performers} performers ({progress_percentage*100:.2f}%)")

def update_single_performer(performer_id):
    performer = find_local_performer(performer_id)
    if performer:
        update_performer_data(performer)
    else:
        log.error(f"Performer with ID {performer_id} not found.")

def get_hook_context():
    try:
        json_input = json.loads(sys.stdin.read())
        hook_context = json_input.get('args', {}).get('hookContext', {})
        return hook_context
    except json.JSONDecodeError:
        log.error("Failed to decode JSON input.")
        return {}

def main():
    hook_context = get_hook_context()
    if hook_context:
        performer_id = hook_context.get('id')
        if performer_id:
            update_single_performer(performer_id)
        else:
            log.error("No performer ID provided in the hook context.")
    else:
        update_all_performers()

if __name__ == "__main__":
    main()
