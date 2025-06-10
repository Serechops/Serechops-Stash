# stash_connection_lib.py
"""
stash_connection_lib – Beginner‑friendly helpers for querying **Stash** GraphQL
configuration.  Import what you need or call `show_help()` in an interactive
session for a quick cheat‑sheet.

Exports
-------
* **connect(fragment)** → `StashConnection`
* **GET_STASH_API_KEY(fragment)** → `str`
* **GET_STASH_BOXES(fragment)** → `list[dict]`
* **GET_STASHES(fragment)** → `list[dict]`
* **GET_PATHS(fragment)** → `dict`
* **GET_SCRAPER_SOURCES(fragment)** → `list[dict]`
* **GET_PLUGIN_SOURCES(fragment)** → `list[dict]`
* **show_help()** → prints inline reference with copy‑pasteable examples
"""

import textwrap
from typing import Any, Dict, List, Optional

import requests

__all__ = [
    "connect",
    "GET_STASH_API_KEY",
    "GET_STASH_BOXES",
    "GET_STASHES",
    "GET_PATHS",
    "GET_SCRAPER_SOURCES",
    "GET_PLUGIN_SOURCES",
    "show_help",
]

###############################################################################
# Core connection object
###############################################################################


class StashConnection:
    """Lightweight wrapper around *requests* session + GraphQL helpers."""

    def __init__(
        self, url: str, session: requests.Session, api_key: Optional[str] = None
    ):
        self.url = url.rstrip("/") + "/graphql"
        self.session = session
        self.api_key = api_key or ""

    # ---------------------------------------------------------------------
    # Construction helpers
    # ---------------------------------------------------------------------
    @classmethod
    def from_fragment(cls, fragment: Dict[str, Any]) -> "StashConnection":
        scheme = fragment.get("Scheme", "http")
        host = fragment.get("Host", "localhost")
        if host == "0.0.0.0":
            host = "localhost"
        port = fragment.get("Port", 9999)
        url = f"{scheme}://{host}:{port}"

        session = requests.Session()
        cookie = fragment.get("SessionCookie")
        if isinstance(cookie, dict):
            name, value = cookie.get("Name"), cookie.get("Value")
            if name and value:
                session.cookies.set(name, value)
        return cls(url, session)

    # ---------------------------------------------------------------------
    # Low‑level query helpers
    # ---------------------------------------------------------------------
    def query(
        self, query: str, variables: Dict[str, Any] | None = None
    ) -> Dict[str, Any]:
        headers = {"apiKey": self.api_key} if self.api_key else {}
        payload = {"query": query}
        if variables is not None:
            payload["variables"] = variables
        resp = self.session.post(self.url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()

    def authenticate(self) -> None:
        """Populate **self.api_key** if the server exposes one."""
        data = self.query("query { configuration { general { apiKey } } }")
        self.api_key = (
            data.get("data", {})
            .get("configuration", {})
            .get("general", {})
            .get("apiKey", "")
        )


###############################################################################
# Public convenience helpers
###############################################################################


def connect(fragment: Dict[str, Any]) -> StashConnection:
    """Return a ready‑to‑use :class:`StashConnection`. Ignores auth errors."""
    conn = StashConnection.from_fragment(fragment)
    try:
        conn.authenticate()
    except Exception:
        pass  # API key is optional
    return conn


def GET_STASH_API_KEY(fragment: Dict[str, Any]) -> str:
    return connect(fragment).api_key


def GET_STASH_BOXES(fragment: Dict[str, Any]) -> List[Dict[str, Any]]:
    conn = connect(fragment)
    data = conn.query(
        """
        query { configuration { general { stashBoxes { endpoint api_key name } } } }
        """
    )
    return (
        data.get("data", {})
        .get("configuration", {})
        .get("general", {})
        .get("stashBoxes", [])
    )


def GET_STASHES(fragment: Dict[str, Any]) -> List[Dict[str, Any]]:
    conn = connect(fragment)
    data = conn.query(
        """
        query { configuration { general { stashes { path excludeVideo excludeImage } } } }
        """
    )
    return (
        data.get("data", {})
        .get("configuration", {})
        .get("general", {})
        .get("stashes", [])
    )


def GET_PATHS(fragment: Dict[str, Any]) -> Dict[str, Any]:
    conn = connect(fragment)
    data = conn.query(
        """
        query { configuration { general {
          databasePath backupDirectoryPath generatedPath metadataPath
          configFilePath scrapersPath pluginsPath cachePath blobsPath
          ffmpegPath ffprobePath
        } } }
        """
    )
    return data.get("data", {}).get("configuration", {}).get("general", {})


def GET_SCRAPER_SOURCES(fragment: Dict[str, Any]) -> List[Dict[str, Any]]:
    conn = connect(fragment)
    data = conn.query(
        """
        query { configuration { general { scraperPackageSources { name url local_path } } } }
        """
    )
    return (
        data.get("data", {})
        .get("configuration", {})
        .get("general", {})
        .get("scraperPackageSources", [])
    )


def GET_PLUGIN_SOURCES(fragment: Dict[str, Any]) -> List[Dict[str, Any]]:
    conn = connect(fragment)
    data = conn.query(
        """
        query { configuration { general { pluginPackageSources { name url local_path } } } }
        """
    )
    return (
        data.get("data", {})
        .get("configuration", {})
        .get("general", {})
        .get("pluginPackageSources", [])
    )


###############################################################################
# Inline help – call stash_connection_lib.show_help() in REPL
###############################################################################

_HELP_TEXT = textwrap.dedent(
    """
    📚 stash_connection_lib quick‑reference
    =====================================

    Basic pattern inside a Stash plugin:

        import json, sys
        from stash_connection_lib import connect, GET_STASH_BOXES

        fragment = json.loads(sys.stdin.read())["server_connection"]
        conn  = connect(fragment)            # StashConnection instance
        boxes = GET_STASH_BOXES(fragment)    # simple helper
        print("Server URL:", conn.url)
        print("API key:", conn.api_key)
        for b in boxes:
            print(b["name"], "→", b["endpoint"])

    One‑liners
    ----------
    * **GET_STASH_API_KEY(frag)**   → str
    * **GET_STASH_BOXES(frag)**     → list[dict]
    * **GET_STASHES(frag)**         → list[dict]
    * **GET_PATHS(frag)**           → dict
    * **GET_SCRAPER_SOURCES(frag)** → list[dict]
    * **GET_PLUGIN_SOURCES(frag)**  → list[dict]

    Full control
    ------------
    ```python
    conn = connect(fragment)
    raw = conn.query("query { stats { scene_count } }")
    ```

    This library never throws if the API key is missing – you’ll simply get an
    empty string and unauthenticated queries.
    """
)


def show_help() -> None:  # noqa: D401 – imperative verb
    """Print an inline cheat‑sheet with examples to stdout."""
    print(_HELP_TEXT)
