import os
import requests
import stashapi.log as log # Using stashapi log for structured logging
from stashapi.stashapp import StashInterface
import json
import sys

# Constants
TARGET_GRAPHQL_URL = "http://localhost:9999/graphql" # Default target GraphQL endpoint
PER_PAGE = 25 # Number of tags per page as per StashDB's pagination


def get_stash_connection_info():
    """
    Retrieves the Stash server connection details and the local API key.

    Returns:
        tuple: (stashdb_endpoint, stashdb_api_key, local_api_key) if successful, with None for missing keys.
    """
    try:
        # Parse the server connection details from stdin
        json_input = json.loads(sys.stdin.read())
        FRAGMENT_SERVER = json_input.get("server_connection")

        # Initialize StashInterface
        stash = StashInterface(FRAGMENT_SERVER)
        stash_config = stash.get_configuration()

        # Extract StashBox connection info (StashDB)
        stash_boxes = stash_config.get("general", {}).get("stashBoxes", [])
        if not stash_boxes:
            log.error("No stashBoxes found in the configuration.")
            return None, None, None

        # Assuming the first stashBox is the target for StashDB
        stashdb_info = stash_boxes[0]
        stashdb_endpoint = stashdb_info.get("endpoint")
        stashdb_api_key = stashdb_info.get("api_key")

        if not stashdb_endpoint:
            log.error("StashDB endpoint not found in configuration.")
            return None, None, None

        log.info(f"Retrieved StashDB endpoint: {stashdb_endpoint}")
        if stashdb_api_key:
            log.info(f"Retrieved StashDB API Key: {stashdb_api_key[:6]}... (hidden for security)")
        else:
            log.warning("No StashDB API Key found in configuration.")

        # Retrieve Local API Key
        local_api_key = stash_config.get("general", {}).get("apiKey")
        if not local_api_key:
            log.warning("Local API Key not found in the configuration. Proceeding without it.")

        return stashdb_endpoint, stashdb_api_key, local_api_key
    except Exception as e:
        log.error(f"Error retrieving Stash connection info: {e}")
        return None, None, None


def fetch_all_stashdb_tags(stashdb_endpoint, api_key=None):
    """
    Fetch all tags from StashDB with pagination.
    Returns a list of tag dictionaries.
    """
    log.info("Fetching tags from StashDB...")
    all_tags = []
    page = 1
    total_pages = 1 # Initialize to enter the loop

    query = """
    query QueryTags($per_page: Int!, $page: Int!) {
        queryTags(input: { per_page: $per_page, page: $page }) {
            count
            tags {
                id
                name
                description
                aliases
                deleted
                created
                updated
                category {
                    id
                    name
                    group
                    description
                }
            }
        }
    }
    """

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["ApiKey"] = api_key

    while page <= total_pages:
        variables = {"per_page": PER_PAGE, "page": page}
        try:
            response = requests.post(
                stashdb_endpoint,
                json={"query": query, "variables": variables},
                headers=headers,
            )
            if response.status_code == 200:
                data = response.json()
                tag_data = data.get("data", {}).get("queryTags", {})
                tags = tag_data.get("tags", [])
                # Normalize: the GraphQL `id` returned by StashDB is the local
                # stash id for that tag. Add a `stash_id` key so downstream
                # code explicitly uses the external stash id value.
                for t in tags:
                    if "stash_id" not in t:
                        t["stash_id"] = t.get("id")
                all_tags.extend(tags)

                # Calculate total pages based on count
                if page == 1:
                    total_count = tag_data.get("count", 0)
                    total_pages = (total_count + PER_PAGE - 1) // PER_PAGE # Ceiling division
                    log.info(f"Total tags to fetch: {total_count} across {total_pages} pages.")

                log.progress(page / total_pages) # Update progress
                page += 1
            else:
                log.error(f"Failed to fetch tags from StashDB. HTTP {response.status_code}: {response.text}")
                break
        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching tags from StashDB: {e}")
            break

    log.info(f"Completed fetching tags from StashDB. Total tags fetched: {len(all_tags)}.")
    return all_tags


def get_existing_tags(target_graphql_url, local_api_key=None):
    """
    Fetch existing tags (ID, Name, Aliases, Description, stash_ids) from the target system.
    Returns a dictionary mapping lowercase tag name OR alias to {id, name, aliases, description, stash_ids}.
    This is crucial for preventing conflicts AND for preserving existing data during update.
    """
    log.info("Fetching existing tags (including aliases, description, stash_ids) from the target system...")

    headers = {"Content-Type": "application/json"}
    if local_api_key:
        headers["ApiKey"] = local_api_key

    # Query for all tags with all metadata fields
    query = """
    query {
        allTags {
            id
            name
            aliases
            description
            stash_ids {
                endpoint
                stash_id
                updated_at
            }
        }
    }
    """
    try:
        response = requests.post(target_graphql_url, json={"query": query}, headers=headers)
        if response.status_code == 200:
            data = response.json()
            tags = data.get("data", {}).get("allTags", [])
            
            # Map: lowercase_name_or_alias -> {id, name, aliases}
            existing_tag_map = {}
            # Map: stash_id (string) -> tag_info for quick lookup by external IDs
            existing_stashid_map = {}
            for tag in tags:
                tag_id = tag["id"]
                tag_name = tag["name"]
                tag_aliases = tag.get("aliases", [])
                tag_description = tag.get("description", "")
                tag_stash_ids = tag.get("stash_ids", [])

                tag_info = {"id": tag_id, "name": tag_name, "aliases": tag_aliases, "description": tag_description, "stash_ids": tag_stash_ids}
                
                # 1. Map the primary name
                existing_tag_map[tag_name.lower()] = tag_info
                
                # 2. Map all aliases to the same tag ID and info
                for alias in tag_aliases:
                    # Only map the alias if it hasn't already been mapped as a primary name
                    if alias.lower() not in existing_tag_map:
                        existing_tag_map[alias.lower()] = tag_info

                # Map any structured stash_ids by their `stash_id` value for lookups by external id
                for s in tag_stash_ids:
                    if isinstance(s, dict):
                        sid = s.get("stash_id")
                        if sid:
                            # stash ids are unique; map by raw string
                            existing_stashid_map[str(sid)] = tag_info

            log.info(f"Existing names and aliases mapped: {len(existing_tag_map)}; stash_ids mapped: {len(existing_stashid_map)}.")
            return existing_tag_map, existing_stashid_map
        else:
            log.error(f"Failed to fetch existing tags. HTTP {response.status_code}: {response.text}")
            return {}
    except requests.exceptions.RequestException as e:
        log.error(f"Error fetching existing tags: {e}")
        return {}, {}


def write_existing_tags_master(existing_tag_map, filename="existing_tags_master.json"):
    """
    Write a deduplicated JSON file of existing tags (unique by local id) to the cwd.
    The output contains id, name, aliases, and stash_ids for each tag.
    """
    try:
        tags_by_id = {}
        for info in existing_tag_map.values():
            if not info:
                continue
            tag_id = info.get("id")
            if not tag_id:
                continue
            entry = tags_by_id.setdefault(tag_id, {"id": tag_id, "name": info.get("name"), "description": info.get("description", ""), "aliases": set(), "stash_ids": []})
            # merge aliases
            for a in info.get("aliases", []):
                if a:
                    entry["aliases"].add(a)
            # append stash_ids objects (may contain endpoint/stash_id)
            for s in info.get("stash_ids", []):
                if s and isinstance(s, dict) and s.get("stash_id"):
                    entry["stash_ids"].append(s)

        # Convert sets and dedupe stash_ids
        output_list = []
        for entry in tags_by_id.values():
            aliases = sorted(list(entry.get("aliases", [])))
            # dedupe stash_ids by tuple(endpoint, stash_id)
            seen = set()
            deduped_stash_ids = []
            for s in entry.get("stash_ids", []):
                key = (s.get("endpoint"), s.get("stash_id"))
                if key not in seen:
                    seen.add(key)
                    deduped_stash_ids.append({"endpoint": s.get("endpoint"), "stash_id": s.get("stash_id")})

            output_list.append({
                "id": entry.get("id"),
                "name": entry.get("name"),
                "description": entry.get("description", ""),
                "aliases": aliases,
                "stash_ids": deduped_stash_ids,
            })

        with open(filename, "w", encoding="utf-8") as f:
            json.dump({"generated": True, "count": len(output_list), "tags": output_list}, f, indent=2, ensure_ascii=False)

        log.info(f"Wrote existing tags master JSON to {filename} ({len(output_list)} tags).")
    except Exception as e:
        log.error(f"Failed to write existing tags master JSON: {e}")


def create_tags_in_target(tags, target_graphql_url, local_api_key=None, stashdb_endpoint=None, existing_tag_map=None):
    """
    Create new tags in the target system using the TagCreate mutation.
    """
    log.info("Starting tag creation process in the target system...")

    mutation = """
    mutation TagCreate($input: TagCreateInput!) {
        tagCreate(input: $input) {
            id
            name
            description
            aliases
        }
    }
    """

    headers = {"Content-Type": "application/json"}
    if local_api_key:
        headers["ApiKey"] = local_api_key

    total_tags = len(tags)
    created_count = 0

    # Prepare a set of existing names for quick checks (lowercased)
    existing_names = set()
    if existing_tag_map:
        for info in existing_tag_map.values():
            existing_names.add(info.get("name", "").lower())

    for index, tag in enumerate(tags, 1):
        tag_name = tag["name"]
        description = tag.get("description", "")
        aliases = tag.get("aliases", [])

        # The target GraphQL `TagCreate` input does not accept a local `id` override,
        # but it does accept `stash_ids` to store external IDs. Include the
        # StashDB tag UUID in `stash_ids` when present so we preserve the source UUID.
        input_data = {
            "name": tag_name,
            "description": description,
            "aliases": aliases,
        }

        stashdb_id = tag.get("stash_id", tag.get("id"))
        if stashdb_id:
            # stash_ids expects objects (StashIDInput), not raw strings.
            # Provide the source endpoint so the target knows where the external ID came from.
            source_endpoint = stashdb_endpoint or tag.get("source_endpoint")
            stash_obj = {"endpoint": source_endpoint, "stash_id": stashdb_id} if source_endpoint else {"stash_id": stashdb_id}
            input_data["stash_ids"] = [stash_obj]

        # Skip creation if a tag with this name already exists (case-insensitive)
        if tag_name.lower() in existing_names:
            log.info(f"[{index}/{total_tags}] Skipping creation for existing tag '{tag_name}'.")
            # Optionally, update existing_tag_map entry with stash_ids/aliases
            continue

        variables = {"input": input_data}
        try:
            response = requests.post(
                target_graphql_url,
                json={"query": mutation, "variables": variables},
                headers=headers,
            )
            if response.status_code == 200:
                result = response.json()
                if "errors" in result:
                    log.warning(f"[{index}/{total_tags}] Failed to create tag '{tag_name}'. Errors: {result['errors']}")
                else:
                    created_count += 1
                    log.info(f"[{index}/{total_tags}] Tag '{tag_name}' created successfully.")

                    # Update existing_names and existing_tag_map so subsequent operations know this exists
                    created = result.get("data", {}).get("tagCreate")
                    if created and existing_tag_map is not None:
                        created_id = created.get("id")
                        created_name = created.get("name")
                        created_aliases = created.get("aliases", [])
                        # stash_ids we sent are not returned by some APIs; attempt to preserve from input
                        created_info = {"id": created_id, "name": created_name, "aliases": created_aliases, "stash_ids": input_data.get("stash_ids", [])}
                        existing_tag_map[created_name.lower()] = created_info
                        existing_names.add(created_name.lower())
            else:
                log.warning(f"[{index}/{total_tags}] Failed to create tag '{tag_name}'. HTTP {response.status_code}: {response.text}")
        except requests.exceptions.RequestException as e:
            log.warning(f"[{index}/{total_tags}] Exception while creating tag '{tag_name}': {e}")

        # Progress update
        log.progress(index / total_tags)

    log.info(f"Tag creation process completed. Total tags processed: {total_tags}, Tags created: {created_count}.")


def has_metadata_delta(existing_info, stashdb_tag):
    """
    Check if the StashDB tag has metadata that's missing or different from the existing local tag.
    Returns True if an update is needed, False otherwise.
    """
    # Check description
    local_desc = (existing_info.get("description") or "").strip()
    stashdb_desc = (stashdb_tag.get("description") or "").strip()
    if stashdb_desc and stashdb_desc != local_desc:
        return True

    # Check if StashDB has aliases that local doesn't have
    local_aliases_set = set(existing_info.get("aliases", []))
    stashdb_aliases_set = set(stashdb_tag.get("aliases", []))
    if stashdb_aliases_set - local_aliases_set:  # StashDB has aliases we don't
        return True

    # Check if StashDB has a stash_id that local doesn't have
    local_stash_ids = set()
    for s in existing_info.get("stash_ids", []):
        if isinstance(s, dict) and s.get("stash_id"):
            local_stash_ids.add(str(s.get("stash_id")))
    
    stashdb_id = str(stashdb_tag.get("stash_id", stashdb_tag.get("id") or ""))
    if stashdb_id and stashdb_id not in local_stash_ids:
        return True

    return False


def update_tags_in_target(tags_to_update, target_graphql_url, local_api_key=None, stashdb_endpoint=None):
    """
    Update existing tags in the target system using the TagUpdate mutation.
    It merges existing local aliases with new StashDB aliases.
    Only updates tags that have metadata deltas (missing or different data).
    """
    log.info("Starting tag update process in the target system...")

    mutation = """
    mutation TagUpdate($input: TagUpdateInput!) {
        tagUpdate(input: $input) {
            id
            name
            description
            aliases
        }
    }
    """

    headers = {"Content-Type": "application/json"}
    if local_api_key:
        headers["ApiKey"] = local_api_key

    total_tags = len(tags_to_update)
    updated_count = 0
    skipped_count = 0

    for index, tag_data in enumerate(tags_to_update, 1):
        stashdb_tag = tag_data["stashdb_tag"]
        existing_info = tag_data["existing_info"]
        tag_name = existing_info["name"]
        tag_id = existing_info["id"]

        # Check if there's actually a metadata delta to apply
        if not has_metadata_delta(existing_info, stashdb_tag):
            skipped_count += 1
            log.debug(f"[{index}/{total_tags}] Skipping '{tag_name}' - no metadata delta.")
            log.progress(index / total_tags)
            continue

        # Preserve Aliases and stash_ids Logic
        # 1. Get existing aliases from the target tag (fetched in get_existing_tags)
        local_aliases = set(existing_info.get("aliases", []))

        # 2. Get new aliases from StashDB
        stashdb_aliases = set(stashdb_tag.get("aliases", []))

        # 3. Merge and deduplicate the alias lists
        merged_aliases = list(local_aliases.union(stashdb_aliases))

        # 4. Merge stash_ids (preserve existing external ID objects and add StashDB UUID)
        # existing_info['stash_ids'] is expected to be a list of objects: { endpoint, stash_id }
        local_stash_objs = existing_info.get("stash_ids", [])
        # Normalize to set of tuples for deduplication
        local_stash_ids = set((s.get("endpoint"), s.get("stash_id")) for s in local_stash_objs if s.get("stash_id"))

        stashdb_id = stashdb_tag.get("stash_id", stashdb_tag.get("id"))
        source_endpoint = stashdb_endpoint or stashdb_tag.get("source_endpoint")
        stashdb_tuple = (source_endpoint, stashdb_id) if stashdb_id else None

        if stashdb_tuple:
            merged_tuples = local_stash_ids.union({stashdb_tuple})
        else:
            merged_tuples = local_stash_ids

        # Convert back to list of objects
        merged_stash_ids = [{"endpoint": t[0], "stash_id": t[1]} for t in merged_tuples]

        # 5. Use StashDB's description
        description = stashdb_tag.get("description", "")
        
        log.debug(f"Updating '{tag_name}'. Merged aliases: {merged_aliases}")

        input_data = {
            "id": tag_id,
            "description": description,
            "aliases": merged_aliases, # Use the merged list
            "stash_ids": merged_stash_ids,
        }

        variables = {"input": input_data}
        try:
            response = requests.post(
                target_graphql_url,
                json={"query": mutation, "variables": variables},
                headers=headers,
            )
            if response.status_code == 200:
                result = response.json()
                if "errors" in result:
                    log.warning(f"[{index}/{total_tags}] Failed to update tag '{tag_name}' (ID: {tag_id}). Errors: {result['errors']}")
                else:
                    updated_count += 1
                    log.info(f"[{index}/{total_tags}] Local tag '{tag_name}' (via StashDB tag '{stashdb_tag['name']}') updated successfully. Aliases merged.")
            else:
                log.warning(f"[{index}/{total_tags}] Failed to update tag '{tag_name}' (ID: {tag_id}). HTTP {response.status_code}: {response.text}")
        except requests.exceptions.RequestException as e:
            log.warning(f"[{index}/{total_tags}] Exception while updating tag '{tag_name}' (ID: {tag_id}): {e}")

        # Progress update
        log.progress(index / total_tags)

    log.info(f"Tag update process completed. Total tags processed: {total_tags}, Tags updated: {updated_count}, Skipped (no delta): {skipped_count}.")


def main():
    # Step 1: Retrieve StashDB and local connection info
    stashdb_endpoint, stashdb_api_key, local_api_key = get_stash_connection_info()
    if not stashdb_endpoint:
        log.error("Unable to retrieve necessary connection information. Exiting.")
        return

    # Step 2: Fetch existing tags (name, id, aliases, stash_ids) from the target system
    # existing_tags_map: {lowercase_name_or_alias: {id: <tag_id>, name: <tag_name>, aliases: [<alias1>, ...], stash_ids: [...]}}
    existing_tags_map, existing_stashid_map = get_existing_tags(TARGET_GRAPHQL_URL, local_api_key)

    # Dump the existing tags master JSON for offline comparison / delta calculation
    write_existing_tags_master(existing_tags_map, "existing_tags_master.json")

    # Derive unique local tag count for logging
    # Derive unique local tag count for logging
    local_ids = set()
    for v in existing_tags_map.values():
        if v and v.get("id"):
            local_ids.add(v.get("id"))
    
    log.info(f"Local tags found: {len(local_ids)}")
    
    # Step 3: Fetch all tags from StashDB once for comprehensive comparison
    log.info("Fetching all tags from StashDB for delta comparison...")
    stashdb_tags = fetch_all_stashdb_tags(stashdb_endpoint, stashdb_api_key)

    if not stashdb_tags:
        log.error("No tags fetched from StashDB. Exiting.")
        return

    log.info(f"StashDB tags fetched: {len(stashdb_tags)}")

    # Step 4: Compare StashDB tags with local tags to detect deltas
    new_tags = []
    tags_to_update = []

    for stashdb_tag in stashdb_tags:
        tag_name_lower = stashdb_tag["name"].lower()
        stashdb_id = str(stashdb_tag.get("stash_id", stashdb_tag.get("id") or ""))

        # Check if tag exists locally (by name/alias or stash_id)
        existing_info = None
        if tag_name_lower in existing_tags_map:
            existing_info = existing_tags_map[tag_name_lower]
        elif stashdb_id and stashdb_id in existing_stashid_map:
            existing_info = existing_stashid_map[stashdb_id]
        
        if existing_info:
            # Tag exists - check if it has metadata deltas
            if has_metadata_delta(existing_info, stashdb_tag):
                tags_to_update.append({"stashdb_tag": stashdb_tag, "existing_info": existing_info})
        else:
            # Tag doesn't exist locally - mark for creation
            new_tags.append(stashdb_tag)

    log.info(f"Tags with metadata deltas (to update): {len(tags_to_update)}")
    log.info(f"New tags (to create): {len(new_tags)}")

    if not tags_to_update and not new_tags:
        log.info("No tags need updates or creation. All metadata is synchronized.")
        return

    # Step 5: Update existing tags that have deltas
    if tags_to_update:
        update_tags_in_target(tags_to_update, TARGET_GRAPHQL_URL, local_api_key, stashdb_endpoint)

    # Step 6: Create new tags
    if new_tags:
        create_tags_in_target(new_tags, TARGET_GRAPHQL_URL, local_api_key, stashdb_endpoint, existing_tags_map)


if __name__ == "__main__":
    main()
