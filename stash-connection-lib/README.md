# 📦 stash‑connection‑lib

Beginner‑friendly helpers for **Stash** plugin developers to read a running
Stash server's connection fragment, grab an (optional) local API key, and query
specific pieces of the `configuration.general` GraphQL tree—without needing to
learn the whole schema.

<p align="center">
  <img src="https://img.shields.io/pypi/v/stash-connection-lib?color=brightgreen" />
  <img src="https://img.shields.io/pypi/pyversions/stash-connection-lib" />
  <img src="https://img.shields.io/pypi/l/stash-connection-lib" />
  <img src="https://img.shields.io/badge/tests-30%20passing-brightgreen" />
</p>

---

## ✨ Features

| Helper                          | Returns                                                |
| ------------------------------- | ------------------------------------------------------ |
| `connect(fragment)`             | `StashConnection` object (auto‑auth if API key exists) |
| `GET_STASH_API_KEY(fragment)`   | Local API key _(empty string if none)_                 |
| `GET_STASH_BOXES(fragment)`     | `[ {endpoint, api_key, name}, … ]`                     |
| `GET_STASHES(fragment)`         | `[ {path, excludeVideo, excludeImage}, … ]`            |
| `GET_PATHS(fragment)`           | All path settings (_databasePath, pluginsPath …_)      |
| `GET_SCRAPER_SOURCES(fragment)` | Community scraper sources list                         |
| `GET_PLUGIN_SOURCES(fragment)`  | Plugin sources list                                    |
| `show_help()`                   | Prints inline reference with copy‑pasteable examples   |

Each call performs a **single, minimal GraphQL query**—no overfetching.

---

## 🛠 Installation

```bash
pip install stash-connection-lib
```

## 🚀 Quick‑start

```python
import json
import sys
from stash_connection_lib import (
    connect, GET_STASH_API_KEY, GET_STASH_BOXES, GET_PATHS
)

# Read the fragment from Stash plugin input
fragment = json.loads(sys.stdin.read())["server_connection"]

# Get specific configuration data
api_key = GET_STASH_API_KEY(fragment)
boxes = GET_STASH_BOXES(fragment)
paths = GET_PATHS(fragment)

print("API key:", api_key)
for box in boxes:
    print(f"{box['name']} → {box['endpoint']}")
print("Database located at:", paths.get("databasePath", "Not configured"))

# Or use the connection object for custom queries
conn = connect(fragment)
result = conn.query("query { stats { scene_count } }")
print("Scene count:", result["data"]["stats"]["scene_count"])
```

## 📖 Interactive Help

Need a quick reference while coding? Use the built-in help function:

```python
# In a Python REPL or Jupyter notebook
from stash_connection_lib import show_help

show_help()
```

This prints a comprehensive reference with copy‑pasteable examples:

```python
# Or import everything and get help
import stash_connection_lib
stash_connection_lib.show_help()

# Perfect for interactive development sessions
```

The help output includes:

- Function signatures and return types
- Real-world usage examples for each helper
- Common patterns for Stash plugin development
- Error handling best practices

## 🧩 How it works

**Connection Management:**

- `StashConnection.from_fragment(fragment)` builds a `requests.Session` pointed at `http(s)://Host:Port/graphql`
- Automatically handles session cookies if provided in the fragment
- Converts `0.0.0.0` host to `localhost` for compatibility

**Authentication:**

- `authenticate()` attempts to fetch the API key from the server
- Authentication failures are handled gracefully—the library works on servers without API keys
- The `connect()` function automatically attempts authentication and falls back silently on errors

**Data Retrieval:**

- Helper functions compose targeted GraphQL queries for specific configuration sections
- Responses are returned as plain Python dictionaries/lists—no extra models or dependencies
- Missing data returns empty collections (`[]` or `{}`) rather than raising exceptions

## 🔧 Advanced Usage

### Custom Queries with StashConnection

```python
from stash_connection_lib import connect

conn = connect(fragment)

# Query with variables
result = conn.query("""
    query FindScenes($filter: FindFilterType) {
        findScenes(filter: $filter) {
            count
            scenes { id title }
        }
    }
""", {"filter": {"per_page": 10}})

print(f"Found {result['data']['findScenes']['count']} scenes")
```

### Error Handling

The library is designed to be robust:

```python
# These will return empty values instead of crashing
api_key = GET_STASH_API_KEY(malformed_fragment)  # Returns ""
boxes = GET_STASH_BOXES(offline_fragment)        # Returns []
paths = GET_PATHS(restricted_fragment)           # Returns {}
```

### Session Cookie Support

```python
# Fragment with authentication cookie
fragment = {
    "Scheme": "https",
    "Host": "my-stash.example.com",
    "Port": 9999,
    "SessionCookie": {
        "Name": "stash_session",
        "Value": "your-session-token"
    }
}

conn = connect(fragment)  # Automatically uses the session cookie
```

### Getting Help During Development

```python
# Quick reference without leaving your editor
from stash_connection_lib import show_help, connect

# See all available functions and examples
show_help()

# Then use what you need
conn = connect(fragment)
# ... rest of your plugin code
```

## 🧪 Testing

The library includes comprehensive tests covering:

- Connection management and URL construction
- Fragment parsing with various configurations
- Authentication success and failure scenarios
- All convenience functions with mock responses
- Error handling and edge cases
- Session cookie management

Run tests with:

```bash
python -m pytest tests/ -v
```

## 📋 Requirements

- Python 3.8+
- `requests` library
- `typing` (included in Python 3.8+)

## 🤝 Contributing

Contributions are welcome! Please ensure:

1. All existing tests pass: `python -m pytest tests/`
2. New features include appropriate tests
3. Code follows the existing style conventions

## 📄 License

This project is licensed under the MIT License.

---

**Perfect for Stash plugin developers who want to:**

- ✅ Skip learning the full Stash GraphQL schema
- ✅ Get configuration data with simple function calls
- ✅ Handle authentication and connection errors gracefully
- ✅ Focus on plugin logic rather than API integration
- ✅ Get instant help and examples during development
