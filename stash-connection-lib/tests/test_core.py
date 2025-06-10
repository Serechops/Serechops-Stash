from unittest.mock import Mock

import requests
from stash_connection_lib.core import (
    GET_PATHS,
    GET_PLUGIN_SOURCES,
    GET_SCRAPER_SOURCES,
    GET_STASH_API_KEY,
    GET_STASH_BOXES,
    GET_STASHES,
    StashConnection,
    connect,
)


class TestStashConnection:
    """Test cases for StashConnection class."""

    def test_init_basic(self):
        """Test basic StashConnection initialization."""
        session = requests.Session()
        conn = StashConnection("http://localhost:9999", session)

        assert conn.url == "http://localhost:9999/graphql"
        assert conn.session == session
        assert conn.api_key == ""

    def test_init_with_trailing_slash(self):
        """Test StashConnection init with trailing slash in URL."""
        session = requests.Session()
        conn = StashConnection("http://localhost:9999/", session)
        assert conn.url == "http://localhost:9999/graphql"

    def test_init_with_api_key(self):
        """Test StashConnection init with API key."""
        session = requests.Session()
        conn = StashConnection("http://localhost:9999", session, "test_key")
        assert conn.api_key == "test_key"

    def test_init_with_none_api_key(self):
        """Test StashConnection init with None API key."""
        session = requests.Session()
        conn = StashConnection("http://localhost:9999", session, None)
        assert conn.api_key == ""

    def test_from_fragment_basic(self):
        """Test from_fragment with basic configuration."""
        fragment = {"Scheme": "https", "Host": "example.com", "Port": 8080}
        conn = StashConnection.from_fragment(fragment)
        assert conn.url == "https://example.com:8080/graphql"

    def test_from_fragment_defaults(self):
        """Test from_fragment with default values."""
        fragment = {}
        conn = StashConnection.from_fragment(fragment)
        assert conn.url == "http://localhost:9999/graphql"

    def test_from_fragment_localhost_conversion(self):
        """Test from_fragment converts 0.0.0.0 to localhost."""
        fragment = {"Host": "0.0.0.0"}
        conn = StashConnection.from_fragment(fragment)
        assert conn.url == "http://localhost:9999/graphql"

    def test_from_fragment_with_session_cookie(self):
        """Test from_fragment with session cookie."""
        fragment = {
            "Scheme": "http",
            "Host": "localhost",
            "Port": 9999,
            "SessionCookie": {"Name": "session", "Value": "abc123"},
        }
        conn = StashConnection.from_fragment(fragment)
        assert "session" in conn.session.cookies
        assert conn.session.cookies["session"] == "abc123"

    def test_from_fragment_invalid_cookie(self):
        """Test from_fragment with invalid session cookie."""
        fragment = {"SessionCookie": {"Name": "session"}}  # Missing Value
        conn = StashConnection.from_fragment(fragment)
        assert len(conn.session.cookies) == 0

    def test_query_with_api_key(self, monkeypatch):
        """Test query method with API key."""
        session = requests.Session()
        conn = StashConnection("http://localhost:9999", session, "test_key")

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"data": {"test": "value"}}

        def mock_post(*args, **kwargs):
            assert kwargs["headers"]["apiKey"] == "test_key"
            assert kwargs["json"]["query"] == "test query"
            return mock_response

        monkeypatch.setattr(session, "post", mock_post)
        result = conn.query("test query")
        assert result == {"data": {"test": "value"}}

    def test_query_without_api_key(self, monkeypatch):
        """Test query method without API key."""
        session = requests.Session()
        conn = StashConnection("http://localhost:9999", session)

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"data": {"test": "value"}}

        def mock_post(*args, **kwargs):
            assert kwargs["headers"] == {}
            assert kwargs["json"]["query"] == "test query"
            return mock_response

        monkeypatch.setattr(session, "post", mock_post)
        result = conn.query("test query")
        assert result == {"data": {"test": "value"}}

    def test_query_with_variables(self, monkeypatch):
        """Test query method with variables."""
        session = requests.Session()
        conn = StashConnection("http://localhost:9999", session)

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"data": {"test": "value"}}

        def mock_post(*args, **kwargs):
            assert kwargs["json"]["variables"] == {"var1": "value1"}
            return mock_response

        monkeypatch.setattr(session, "post", mock_post)
        result = conn.query("test query", {"var1": "value1"})
        assert result == {"data": {"test": "value"}}

    def test_authenticate_success(self, monkeypatch):
        """Test authenticate method with successful response."""
        session = requests.Session()
        conn = StashConnection("http://localhost:9999", session)

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "data": {"configuration": {"general": {"apiKey": "fetched_key"}}}
        }

        monkeypatch.setattr(session, "post", lambda *args, **kwargs: mock_response)
        conn.authenticate()
        assert conn.api_key == "fetched_key"

    def test_authenticate_empty_response(self, monkeypatch):
        """Test authenticate method with empty response."""
        session = requests.Session()
        conn = StashConnection("http://localhost:9999", session)

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {}

        monkeypatch.setattr(session, "post", lambda *args, **kwargs: mock_response)
        conn.authenticate()
        assert conn.api_key == ""


class TestConnectFunction:
    """Test cases for connect function."""

    def test_connect_with_authentication(self, monkeypatch):
        """Test connect function with successful authentication."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "data": {"configuration": {"general": {"apiKey": "auth_key"}}}
        }

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )
        conn = connect(fragment)
        assert conn.api_key == "auth_key"
        assert conn.url.endswith("/graphql")

    def test_connect_auth_failure(self, monkeypatch):
        """Test connect function with authentication failure."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        def mock_post(*args, **kwargs):
            raise Exception("Auth failed")

        monkeypatch.setattr("requests.Session.post", mock_post)
        conn = connect(fragment)
        assert conn.api_key == ""

    def test_connect_http_error(self, monkeypatch):
        """Test connect function with HTTP error during authentication."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.HTTPError("404 Not Found")
        mock_response.json.return_value = {}

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )
        conn = connect(fragment)
        assert conn.api_key == ""


class TestConvenienceFunctions:
    """Test cases for convenience functions."""

    def test_get_stash_api_key(self, monkeypatch):
        """Test GET_STASH_API_KEY function."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "data": {"configuration": {"general": {"apiKey": "api_key_value"}}}
        }

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )
        api_key = GET_STASH_API_KEY(fragment)
        assert api_key == "api_key_value"

    def test_get_stash_boxes(self, monkeypatch):
        """Test GET_STASH_BOXES function."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "data": {
                "configuration": {
                    "general": {
                        "stashBoxes": [
                            {
                                "endpoint": "https://stashdb.org",
                                "api_key": "key1",
                                "name": "StashDB",
                            },
                            {
                                "endpoint": "https://pmvstash.org",
                                "api_key": "key2",
                                "name": "PMVStash",
                            },
                        ]
                    }
                }
            }
        }

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )
        boxes = GET_STASH_BOXES(fragment)
        assert len(boxes) == 2
        assert boxes[0]["name"] == "StashDB"
        assert boxes[1]["endpoint"] == "https://pmvstash.org"

    def test_get_stashes(self, monkeypatch):
        """Test GET_STASHES function."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "data": {
                "configuration": {
                    "general": {
                        "stashes": [
                            {
                                "path": "/videos",
                                "excludeVideo": False,
                                "excludeImage": True,
                            },
                            {
                                "path": "/images",
                                "excludeVideo": True,
                                "excludeImage": False,
                            },
                        ]
                    }
                }
            }
        }

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )
        stashes = GET_STASHES(fragment)
        assert len(stashes) == 2
        assert stashes[0]["path"] == "/videos"
        assert stashes[1]["excludeVideo"] is True

    def test_get_paths(self, monkeypatch):
        """Test GET_PATHS function."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "data": {
                "configuration": {
                    "general": {
                        "databasePath": "/data/stash.db",
                        "generatedPath": "/data/generated",
                        "metadataPath": "/data/metadata",
                        "ffmpegPath": "/usr/bin/ffmpeg",
                        "configFilePath": "/config/config.yml",
                    }
                }
            }
        }

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )
        paths = GET_PATHS(fragment)
        assert paths["databasePath"] == "/data/stash.db"
        assert paths["ffmpegPath"] == "/usr/bin/ffmpeg"
        assert paths["configFilePath"] == "/config/config.yml"

    def test_get_scraper_sources(self, monkeypatch):
        """Test GET_SCRAPER_SOURCES function."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "data": {
                "configuration": {
                    "general": {
                        "scraperPackageSources": [
                            {
                                "name": "Community",
                                "url": "https://github.com/stashapp/CommunityScrapers",
                                "local_path": "",
                            }
                        ]
                    }
                }
            }
        }

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )
        sources = GET_SCRAPER_SOURCES(fragment)
        assert len(sources) == 1
        assert sources[0]["name"] == "Community"
        assert "github.com/stashapp/CommunityScrapers" in sources[0]["url"]

    def test_get_plugin_sources(self, monkeypatch):
        """Test GET_PLUGIN_SOURCES function."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "data": {
                "configuration": {
                    "general": {
                        "pluginPackageSources": [
                            {
                                "name": "Official",
                                "url": "https://github.com/stashapp/CommunityPlugins",
                                "local_path": "/plugins",
                            }
                        ]
                    }
                }
            }
        }

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )
        sources = GET_PLUGIN_SOURCES(fragment)
        assert len(sources) == 1
        assert sources[0]["url"] == "https://github.com/stashapp/CommunityPlugins"
        assert sources[0]["local_path"] == "/plugins"


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_response_handling(self, monkeypatch):
        """Test handling of empty/missing data in responses."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {}

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )

        # Should return empty lists/dicts for missing data
        assert GET_STASH_BOXES(fragment) == []
        assert GET_STASHES(fragment) == []
        assert GET_PATHS(fragment) == {}
        assert GET_SCRAPER_SOURCES(fragment) == []
        assert GET_PLUGIN_SOURCES(fragment) == []

    def test_partial_response_data(self, monkeypatch):
        """Test handling of partial response data."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"data": {"configuration": {}}}

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )

        api_key = GET_STASH_API_KEY(fragment)
        assert api_key == ""

        boxes = GET_STASH_BOXES(fragment)
        assert boxes == []

    def test_session_cookie_edge_cases(self):
        """Test session cookie handling edge cases."""
        # Test with invalid cookie dict - missing Value
        fragment = {"SessionCookie": {"Name": "session"}}
        conn = StashConnection.from_fragment(fragment)
        assert len(conn.session.cookies) == 0

        # Test with non-dict cookie
        fragment = {"SessionCookie": "invalid"}
        conn = StashConnection.from_fragment(fragment)
        assert len(conn.session.cookies) == 0

        # Test with empty cookie values
        fragment = {"SessionCookie": {"Name": "", "Value": ""}}
        conn = StashConnection.from_fragment(fragment)
        assert len(conn.session.cookies) == 0

        # Test with None values
        fragment = {"SessionCookie": {"Name": None, "Value": "test"}}
        conn = StashConnection.from_fragment(fragment)
        assert len(conn.session.cookies) == 0

    def test_url_construction_edge_cases(self):
        """Test URL construction with various edge cases."""
        session = requests.Session()

        # Test with double trailing slashes
        conn = StashConnection("http://localhost:9999//", session)
        assert conn.url == "http://localhost:9999/graphql"

        # Test with path in URL
        conn = StashConnection("http://localhost:9999/stash/", session)
        assert conn.url == "http://localhost:9999/stash/graphql"

        # Test fragment with custom scheme and port
        fragment = {"Scheme": "https", "Host": "stash.example.com", "Port": 443}
        conn = StashConnection.from_fragment(fragment)
        assert conn.url == "https://stash.example.com:443/graphql"

    def test_query_with_empty_variables(self, monkeypatch):
        """Test query method with empty variables dict."""
        session = requests.Session()
        conn = StashConnection("http://localhost:9999", session)

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {"data": {"test": "value"}}

        def mock_post(*args, **kwargs):
            assert kwargs["json"]["variables"] == {}
            return mock_response

        monkeypatch.setattr(session, "post", mock_post)
        result = conn.query("test query", {})
        assert result == {"data": {"test": "value"}}

    def test_complex_fragment_parsing(self):
        """Test parsing fragments with all possible fields."""
        fragment = {
            "Scheme": "https",
            "Host": "my-stash.example.com",
            "Port": 8443,
            "SessionCookie": {
                "Name": "stash_session",
                "Value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
            },
        }

        conn = StashConnection.from_fragment(fragment)
        assert conn.url == "https://my-stash.example.com:8443/graphql"
        assert "stash_session" in conn.session.cookies
        assert (
            conn.session.cookies["stash_session"]
            == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        )

    def test_malformed_json_response_handled_gracefully(self, monkeypatch):
        """Test that JSON errors during authentication are handled gracefully."""
        fragment = {"Scheme": "http", "Host": "localhost", "Port": 9999}

        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.side_effect = ValueError("Invalid JSON")

        monkeypatch.setattr(
            "requests.Session.post", lambda *args, **kwargs: mock_response
        )

        # Should handle JSON error gracefully and return empty string
        api_key = GET_STASH_API_KEY(fragment)
        assert api_key == ""
