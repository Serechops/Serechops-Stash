import re
import sys
import json
import requests

import stashapi.log as logger

# -----------------------------
# Helpers
# -----------------------------
def normalize_for_sort(url: str) -> str:
    """
    Normalize URL for sorting ONLY.
    Stored URL is not modified.

    - strip http:// or https://
    - strip leading www.
    - lowercase
    """
    u = re.sub(r"^https?://", "", url, flags=re.IGNORECASE)
    u = re.sub(r"^www\.", "", u, flags=re.IGNORECASE)
    return u.lower()


def build_connection(server_connection: dict):
    scheme = server_connection.get("Scheme", "http")
    host = server_connection.get("Host", "localhost")
    port = server_connection.get("Port", 9999)

    # IMPORTANT: 0.0.0.0 is not a client-reachable address
    if host == "0.0.0.0":
        host = "localhost"

    graphql_url = f"{scheme}://{host}:{port}/graphql"

    session = requests.Session()

    # --- Cookie auth (fallback)
    cookie = server_connection.get("SessionCookie")
    if isinstance(cookie, dict):
        name = cookie.get("Name")
        value = cookie.get("Value")
        if name and value:
            session.cookies.set(name, value)

    return graphql_url, session


def gql(session, graphql_url, query, variables=None, api_key=None):
    headers = {}
    if api_key:
        headers["apiKey"] = api_key

    resp = session.post(
        graphql_url,
        json={"query": query, "variables": variables or {}},
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    payload = resp.json()

    if "errors" in payload:
        raise RuntimeError(payload["errors"])

    return payload["data"]


def fetch_api_key(session, graphql_url):
    """Attempt to retrieve API key (preferred auth)"""
    try:
        data = gql(
            session,
            graphql_url,
            "query { configuration { general { apiKey } } }",
        )
        return (
            data.get("configuration", {})
            .get("general", {})
            .get("apiKey")
        )
    except Exception:
        return None


# -----------------------------
# GraphQL
# -----------------------------
FIND_PERFORMERS_QUERY = """
query FindPerformers {
  findPerformers(
    filter: { per_page: -1 }
    performer_filter: { url: { modifier: NOT_NULL, value: "" } }
  ) {
    performers {
      id
      name
      urls
    }
  }
}
"""

BULK_UPDATE_MUTATION = """
mutation BulkPerformerUpdate($ids: [ID!]!, $urls: [String!]!) {
  bulkPerformerUpdate(
    input: {
      ids: $ids
      urls: { values: $urls, mode: SET }
    }
  ) {
    id
  }
}
"""

# -----------------------------
# Main
# -----------------------------
def main():
    # --- Read plugin input (official Stash method)
    plugin_input = json.loads(sys.stdin.read() or "{}")
    server_connection = plugin_input.get("server_connection", {})
    args = plugin_input.get("args", {})

    dry_run = args.get("dry_run", False)
    log_urls = args.get("log_urls", False)

    graphql_url, session = build_connection(server_connection)

    # --- Prefer API key auth
    api_key = fetch_api_key(session, graphql_url)

    # --- Fetch performers
    data = gql(session, graphql_url, FIND_PERFORMERS_QUERY, api_key=api_key)
    performers = data["findPerformers"]["performers"]

    total = len(performers)
    updated = 0

    for idx, performer in enumerate(performers, start=1):
        logger.progress(idx / total)

        pid = performer["id"]
        name = performer["name"]
        urls = performer.get("urls") or []

        if len(urls) < 2:
            continue

        sorted_urls = sorted(urls, key=normalize_for_sort)

        if urls == sorted_urls:
            continue

        logger.info(f"Sorting URLs for {name} (ID {pid})")

        if log_urls:
            for url in sorted_urls:
                logger.info(f"  → {url}")

        if dry_run:
            continue

        gql(
            session,
            graphql_url,
            BULK_UPDATE_MUTATION,
            variables={
                "ids": [pid],
                "urls": sorted_urls,
            },
            api_key=api_key,
        )

        updated += 1

    logger.progress(1)
    logger.info(f"Completed. Updated {updated} performers.")


# -----------------------------
if __name__ == "__main__":
    main()
