from app.services.price_engine import apply_prices_to_holdings


def test_apply_prices_preserves_broker_market_value():
    rows = apply_prices_to_holdings(
        [
            {
                "quantity": 10,
                "last_price": 100,
                "market_value": 5000.0,
                "symbol": "X",
            }
        ]
    )
    assert rows[0]["market_value"] == 5000.0


def test_apply_prices_fills_market_value_when_missing():
    rows = apply_prices_to_holdings(
        [
            {
                "quantity": 4,
                "last_price": 25.0,
                "symbol": "Y",
            }
        ]
    )
    assert rows[0]["market_value"] == 100.0
