"""AI provider proxy.

Keys live on the server; the browser only ever sees provider metadata. Both
Gemini and the OpenAI-compatible providers are streamed as Server-Sent Events so
the UI can render tokens as they arrive.
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator
from typing import Any

import httpx

from .config import Provider, settings
from .paths import ApiError, bad_request, not_found

RETRYABLE = (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError)


def provider_list() -> list[dict[str, Any]]:
    return [
        {
            "id": provider.id,
            "label": provider.label,
            "description": provider.description,
            "envKey": provider.env_key,
            "model": provider.model,
            "configured": bool(provider.api_key),
        }
        for provider in settings.providers.values()
    ]


def get_provider(provider_id: object) -> Provider:
    if not isinstance(provider_id, str) or provider_id not in settings.providers:
        raise bad_request("Unknown AI provider")

    provider = settings.providers[provider_id]
    if not provider.api_key:
        raise ApiError(
            400,
            f"{provider.label} is not configured. Add {provider.env_key} to your .env file "
            "and restart the server.",
        )
    return provider


def _provider_error(status: int, label: str, detail: str) -> ApiError:
    if status in (401, 403):
        return ApiError(401, f"The AI provider rejected the API key (HTTP {status}).")
    if status == 429:
        return ApiError(429, "The AI provider rate-limited the request (429). Try again shortly.")
    if status == 404:
        return ApiError(404, f"The model was not found (404). {detail}".strip())
    return ApiError(502, f"{label} returned HTTP {status}. {detail}".strip())


async def stream_chat(
    provider_id: object,
    messages: list[dict[str, Any]],
    model: str | None = None,
    system: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> AsyncIterator[str]:
    provider = get_provider(provider_id)

    if not isinstance(messages, list) or not messages:
        raise bad_request("At least one message is required")
    if len(messages) > settings.limits.max_ai_messages:
        raise bad_request(f"At most {settings.limits.max_ai_messages} messages are supported")

    if provider.id == "gemini":
        async for delta in _stream_gemini(provider, messages, model, system, temperature, max_tokens):
            yield delta
        return

    async for delta in _stream_openai(provider, messages, model, system, temperature, max_tokens):
        yield delta


async def _stream_gemini(
    provider: Provider,
    messages: list[dict[str, Any]],
    model: str | None,
    system: str | None,
    temperature: float | None,
    max_tokens: int | None,
) -> AsyncIterator[str]:
    chosen = (model or "").strip() or provider.model
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{chosen}:streamGenerateContent?alt=sse&key={provider.api_key}"
    )

    payload: dict[str, Any] = {
        "contents": [
            {
                "role": "model" if message.get("role") == "assistant" else "user",
                "parts": [{"text": str(message.get("content", ""))}],
            }
            for message in messages
        ],
    }
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
    generation: dict[str, Any] = {}
    if temperature is not None:
        generation["temperature"] = max(0.0, min(float(temperature), 2.0))
    if max_tokens is not None:
        generation["maxOutputTokens"] = max(1, min(int(max_tokens), 32_768))
    if generation:
        payload["generationConfig"] = generation

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
        async with client.stream("POST", url, json=payload) as response:
            if response.status_code >= 400:
                body = (await response.aread()).decode("utf-8", errors="replace")[:400]
                raise _provider_error(response.status_code, provider.label, body)

            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                chunk = line[5:].strip()
                if not chunk or chunk == "[DONE]":
                    continue
                try:
                    data = json.loads(chunk)
                except json.JSONDecodeError:
                    continue
                for candidate in data.get("candidates", []):
                    for part in candidate.get("content", {}).get("parts", []):
                        text = part.get("text")
                        if text:
                            yield text


async def _stream_openai(
    provider: Provider,
    messages: list[dict[str, Any]],
    model: str | None,
    system: str | None,
    temperature: float | None,
    max_tokens: int | None,
) -> AsyncIterator[str]:
    base = (provider.base_url or "").rstrip("/")
    url = f"{base}/chat/completions"
    chosen = (model or "").strip() or provider.model

    conversation: list[dict[str, str]] = []
    if system:
        conversation.append({"role": "system", "content": system})
    conversation.extend(
        {
            "role": "assistant" if message.get("role") == "assistant" else "user",
            "content": str(message.get("content", "")),
        }
        for message in messages
    )

    payload: dict[str, Any] = {"model": chosen, "messages": conversation, "stream": True}
    if temperature is not None:
        payload["temperature"] = max(0.0, min(float(temperature), 2.0))
    if max_tokens is not None:
        payload["max_tokens"] = max(1, min(int(max_tokens), 32_768))

    headers = {"Authorization": f"Bearer {provider.api_key}"}

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0)) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as response:
            if response.status_code >= 400:
                body = (await response.aread()).decode("utf-8", errors="replace")[:400]
                raise _provider_error(response.status_code, provider.label, body)

            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                chunk = line[5:].strip()
                if not chunk or chunk == "[DONE]":
                    continue
                try:
                    data = json.loads(chunk)
                except json.JSONDecodeError:
                    continue
                choices = data.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                text = delta.get("content")
                if text:
                    yield text


async def list_models(provider_id: object) -> list[dict[str, str]]:
    provider = get_provider(provider_id)

    if provider.id == "gemini":
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models"
            f"?key={provider.api_key}&pageSize=200"
        )
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url)
        if response.status_code >= 400:
            raise _provider_error(response.status_code, provider.label, response.text[:300])

        models = []
        for entry in response.json().get("models", []):
            name = (entry.get("name") or "").removeprefix("models/")
            actions = entry.get("supportedGenerationMethods") or []
            if not name or (actions and "generateContent" not in actions):
                continue
            models.append({"id": name, "label": entry.get("displayName") or name})
        return sorted(models, key=lambda item: item["id"])

    base = (provider.base_url or "").rstrip("/")
    headers = {"Authorization": f"Bearer {provider.api_key}"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(f"{base}/models", headers=headers)
    except RETRYABLE as error:  # pragma: no cover - network dependent
        raise ApiError(502, f"Could not reach {provider.label}: {error}") from error

    if response.status_code >= 400:
        raise _provider_error(response.status_code, provider.label, response.text[:300])

    models = [
        {"id": entry["id"], "label": entry["id"]}
        for entry in response.json().get("data", [])
        if isinstance(entry, dict) and isinstance(entry.get("id"), str)
    ]
    return sorted(models, key=lambda item: item["id"])[:200]


class RateLimiter:
    """Small fixed-window limiter, keyed by client address."""

    def __init__(self, limit: int, window_seconds: float = 60.0) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    async def check(self, key: str) -> None:
        now = time.monotonic()
        async with self._lock:
            hits = [stamp for stamp in self._hits.get(key, []) if now - stamp < self.window]
            if len(hits) >= self.limit:
                self._hits[key] = hits
                raise ApiError(429, "Too many AI requests. Wait a minute and try again.")
            hits.append(now)
            self._hits[key] = hits


def models_for_ui() -> list[str]:
    return sorted(settings.providers)


def unwrap_provider_id(value: str | None) -> str:
    if value not in settings.providers:
        raise not_found("Unknown provider")
    return value
