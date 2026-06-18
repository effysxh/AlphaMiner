"""共享 LLM / Embedding API 客户端。"""

from __future__ import annotations

import os
import re
import json
from typing import Optional

import httpx
import numpy as np
from dotenv import load_dotenv

load_dotenv()

# ── LLM 配置 ──
API_BASE = os.getenv("ANTHROPIC_BASE_URL", "")
API_KEY = os.getenv("ANTHROPIC_AUTH_TOKEN", "")
DEFAULT_MODEL = os.getenv("ANTHROPIC_MODEL", "glm-5.1")

# ── Embedding 配置 ──
EMBEDDING_API_BASE = os.getenv("EMBEDDING_API_BASE", "")
EMBEDDING_API_KEY = os.getenv("EMBEDDING_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")


def _extract_text(data: dict) -> str:
    for block in data.get("content", []):
        if block.get("type") == "text":
            return block["text"]
    raise ValueError("No text block in response")


def parse_json_text(text: str) -> dict | list:
    """解析 LLM 输出中的 JSON，兼容 markdown 代码块。"""
    m = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1).strip())
    return json.loads(text.strip())


async def call_llm(
    messages: list[dict],
    system: str = "",
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """调用 Anthropic 兼容的 /v1/messages API，返回文本内容。"""
    model = model or DEFAULT_MODEL
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": messages,
        "temperature": temperature,
    }
    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.post(
            f"{API_BASE}/v1/messages",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
            },
            json=payload,
        )
        r.raise_for_status()
    data = r.json()
    return _extract_text(data)


async def call_embedding(text: str) -> Optional[np.ndarray]:
    """调用 Embedding API，返回向量。若未配置则返回 None。"""
    if not EMBEDDING_API_BASE or not EMBEDDING_API_KEY:
        return None

    payload = {
        "model": EMBEDDING_MODEL,
        "input": text,
    }
    async with httpx.AsyncClient(timeout=30) as http:
        r = await http.post(
            f"{EMBEDDING_API_BASE}/embeddings",
            headers={
                "Authorization": f"Bearer {EMBEDDING_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        r.raise_for_status()
    data = r.json()
    vec = data["data"][0]["embedding"]
    return np.array(vec, dtype=np.float32)
