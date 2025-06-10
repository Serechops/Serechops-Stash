# 📦 stash‑connection‑lib

Beginner‑friendly helpers for **Stash** plugin developers to read a running
Stash server’s connection fragment, grab an (optional) local API key, and query
specific pieces of the `configuration.general` GraphQL tree—without needing to
learn the whole schema.

<p align="center">
  <img src="https://img.shields.io/pypi/v/stash-connection-lib?color=brightgreen" />
  <img src="https://img.shields.io/pypi/pyversions/stash-connection-lib" />
  <img src="https://img.shields.io/pypi/l/stash-connection-lib" />
</p>

---

## ✨ Features

| Helper                              | Returns                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `connect(fragment)`                 | `StashConnection` object (auto‑auth if API key exists)  |
| `GET_STASH_API_KEY(fragment)`       | Local API key *(empty string if none)*                  |
| `GET_STASH_BOXES(fragment)`         | `[ {endpoint, api_key, name}, … ]`                      |
| `GET_STASHES(fragment)`             | `[ {path, excludeVideo, excludeImage}, … ]`             |
| `GET_PATHS(fragment)`               | All path settings (*databasePath, pluginsPath …*)       |
| `GET_SCRAPER_SOURCES(fragment)`     | Community scraper sources list                          |
| `GET_PLUGIN_SOURCES(fragment)`      | Plugin sources list                                     |

Each call performs a **single, minimal GraphQL query**—no overfetching.

---

## 🛠 Installation

```bash
pip install stash-connection-lib
```

🚀 Quick‑start

```python
from stash_connection_lib import (
    GET_STASH_API_KEY, GET_STASH_BOXES, GET_PATHS
)

# `fragment` is the JSON object Stash passes to a plugin’s stdin
api_key  = GET_STASH_API_KEY(fragment)
boxes    = GET_STASH_BOXES(fragment)
paths    = GET_PATHS(fragment)

print("API key:", api_key)
for b in boxes:
    print(b["name"], "→", b["endpoint"])
print("Database located at:", paths["databasePath"])
```

## 🧩 How it works
`StashConnection.from_fragment(fragment)` builds a requests.Session
pointed at `http(s)://Host:Port/graphql`, populating cookies if provided.

`authenticate()` queries apiKey; failures are swallowed so the lib
still works on servers without an API key.

Helper functions compose tiny GraphQL queries for one subsection each.

Responses are returned as plain Python dictionaries/lists—no extra models.
