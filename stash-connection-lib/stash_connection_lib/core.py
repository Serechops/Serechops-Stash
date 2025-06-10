# stash_connection_lib.py
"""
stash_connection_lib: Beginner-friendly library for fetching modular Stash configuration sections.

Exports:
  - connect(fragment): Returns an authenticated StashConnection.
  - GET_STASH_API_KEY(fragment)
  - GET_STASH_BOXES(fragment)
  - GET_STASHES(fragment)
  - GET_PATHS(fragment)
  - GET_SCRAPER_SOURCES(fragment)
  - GET_PLUGIN_SOURCES(fragment)
"""
import requests
from typing import Dict, Any, List, Optional

__all__ = [
    "connect", "GET_STASH_API_KEY", "GET_STASH_BOXES", "GET_STASHES",
    "GET_PATHS", "GET_SCRAPER_SOURCES", "GET_PLUGIN_SOURCES"
]

class StashConnection:
    """
    Holds server URL, session, and API key for GraphQL queries.
    """
    def __init__(self, url: str, session: requests.Session, api_key: Optional[str] = None):
        self.url = url.rstrip('/') + '/graphql'
        self.session = session
        self.api_key = api_key or ''

    @classmethod
    def from_fragment(cls, fragment: Dict[str, Any]) -> 'StashConnection':
        scheme = fragment.get("Scheme", "http")
        host = fragment.get("Host", "localhost")
        if host == "0.0.0.0": host = "localhost"
        port = fragment.get("Port", 9999)
        url = f"{scheme}://{host}:{port}"
        session = requests.Session()
        cookie = fragment.get("SessionCookie")
        if isinstance(cookie, dict):
            name, value = cookie.get("Name"), cookie.get("Value")
            if name and value:
                session.cookies.set(name, value)
        return cls(url, session)

    def query(self, query: str, variables: Dict[str, Any] = None) -> Dict[str, Any]:
        headers = {"apiKey": self.api_key} if self.api_key else {}
        payload = {"query": query}
        if variables is not None:
            payload["variables"] = variables
        resp = self.session.post(self.url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()

    def authenticate(self) -> None:
        """Fetch and store API key."""
        query = '''
        query { configuration { general { apiKey } } }
        '''
        data = self.query(query)
        self.api_key = (
            data.get("data", {})
                .get("configuration", {})
                .get("general", {})
                .get("apiKey", "")
        )

# Public functions

def connect(fragment: Dict[str, Any]) -> StashConnection:
    """Build connection and fetch API key if available."""
    conn = StashConnection.from_fragment(fragment)
    try:
        conn.authenticate()
    except Exception:
        pass
    return conn


def GET_STASH_API_KEY(fragment: Dict[str, Any]) -> str:
    """Return the API key or empty string."""
    return connect(fragment).api_key


def GET_STASH_BOXES(fragment: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Fetch stashBoxes list with endpoint, api_key, name."""
    conn = connect(fragment)
    query = '''
    query { configuration { general { stashBoxes { endpoint api_key name } } } }
    '''
    data = conn.query(query)
    return (
        data.get("data", {})
            .get("configuration", {})
            .get("general", {})
            .get("stashBoxes", [])
    )


def GET_STASHES(fragment: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Fetch stashes list with path, excludeVideo, excludeImage."""
    conn = connect(fragment)
    query = '''
    query { configuration { general { stashes { path excludeVideo excludeImage } } } }
    '''
    data = conn.query(query)
    return (
        data.get("data", {})
            .get("configuration", {})
            .get("general", {})
            .get("stashes", [])
    )


def GET_PATHS(fragment: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch all path-related settings."""
    conn = connect(fragment)
    query = '''
    query { configuration { general {
      databasePath backupDirectoryPath generatedPath metadataPath
      configFilePath scrapersPath pluginsPath cachePath
      blobsPath ffmpegPath ffprobePath
    } } }
    '''
    data = conn.query(query)
    return (
        data.get("data", {})
            .get("configuration", {})
            .get("general", {})
    )


def GET_SCRAPER_SOURCES(fragment: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Fetch scraperPackageSources list."""
    conn = connect(fragment)
    query = '''
    query { configuration { general { scraperPackageSources { name url local_path } } } }
    '''
    data = conn.query(query)
    return (
        data.get("data", {})
            .get("configuration", {})
            .get("general", {})
            .get("scraperPackageSources", [])
    )


def GET_PLUGIN_SOURCES(fragment: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Fetch pluginPackageSources list."""
    conn = connect(fragment)
    query = '''
    query { configuration { general { pluginPackageSources { name url local_path } } } }
    '''
    data = conn.query(query)
    return (
        data.get("data", {})
            .get("configuration", {})
            .get("general", {})
            .get("pluginPackageSources", [])
    )
