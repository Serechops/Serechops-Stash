import pytest
from stash_connection_lib import connect

def test_connect_no_api_key(monkeypatch):
    fragment = {"Scheme":"http","Host":"localhost","Port":9999}
    # monkeypatch requests.Session.post to return a minimal auth response
    class DummyResp:
        def raise_for_status(self): pass
        def json(self): return {"data":{"configuration":{"general":{"apiKey":""}}}}
    monkeypatch.setattr("requests.Session.post", lambda *args,**kw: DummyResp())
    conn = connect(fragment)
    assert conn.api_key == ""
    assert conn.url.endswith("/graphql")
