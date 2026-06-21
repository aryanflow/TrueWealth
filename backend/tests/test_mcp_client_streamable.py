from __future__ import annotations

from app.mcp.client import _jsonrpc_messages_from_sse, _pick_jsonrpc_for_id


def test_sse_extracts_data_lines() -> None:
    text = (
        "event: message\n"
        'data: {"jsonrpc":"2.0","method":"server/log","params":{"level":"info"}}\n'
        "\n"
        'data: {"jsonrpc":"2.0","id":"7","result":{"tools":[{"name":"holdings"}]}}\n'
        "\n"
    )
    msgs = _jsonrpc_messages_from_sse(text)
    assert len(msgs) == 2
    picked = _pick_jsonrpc_for_id(msgs, "7")
    assert picked["id"] == "7"
    assert picked["result"]["tools"][0]["name"] == "holdings"


def test_pick_falls_back_to_last_result() -> None:
    msgs = [
        {"jsonrpc": "2.0", "method": "ping"},
        {"jsonrpc": "2.0", "id": "99", "result": {"ok": True}},
    ]
    picked = _pick_jsonrpc_for_id(msgs, "missing")
    assert picked.get("result") == {"ok": True}
