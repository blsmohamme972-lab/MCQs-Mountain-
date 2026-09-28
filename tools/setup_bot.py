#!/usr/bin/env python3
"""Register Kafu's owner-only Telegram webhook after the Worker is deployed."""
import json
import os
try:
    from tools.http_client import request_json
except ModuleNotFoundError:
    from http_client import request_json

token = os.environ["BOT_TOKEN"]
secret = os.environ["WEBHOOK_SECRET"]
url = os.environ.get("KAFU_APP_URL", "https://kafu.blsmohamme97.workers.dev").rstrip("/")

def call(method, data):
    answer = request_json(
        f"https://api.telegram.org/bot{token}/{method}",
        step=f"telegram.setup.{method}",
        method="POST",
        payload=data,
        timeout=20,
    )
    if not answer.get("ok"):
        raise RuntimeError(f"Telegram {method} failed: {answer.get('description')}")

call("setWebhook", {"url": url + "/bot", "secret_token": secret,
                    "allowed_updates": ["message", "callback_query"], "drop_pending_updates": False})
call("setMyCommands", {"scope": {"type": "chat", "chat_id": int(os.environ["OWNER_TELEGRAM_ID"])},
                       "commands": [
                           {"command": "queue", "description": "Show pending uploads"},
                           {"command": "books", "description": "Show published books"},
                           {"command": "status", "description": "Publisher status"},
                           {"command": "flags", "description": "Review held questions"},
                           {"command": "hold", "description": "Hold a question"},
                           {"command": "retry", "description": "Retry a failed upload"},
                           {"command": "clear", "description": "Clear a failed upload"},
                           {"command": "republish", "description": "Republish a release"},
                           {"command": "rollback", "description": "Restore an earlier version"},
                           {"command": "remove", "description": "Remove a book"},
                       ]})
print("Webhook registered for", url + "/bot")
