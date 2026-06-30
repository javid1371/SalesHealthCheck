#!/usr/bin/env python3
"""Strip deprecated npm_config_devdir before npm invocations (Cursor sandbox sets it)."""

from __future__ import annotations

import json
import re
import sys

NPM_RE = re.compile(r"\bnpm\b")
UNSET_PREFIX = "env -u npm_config_devdir npm"


def rewrite_command(command: str) -> str | None:
    if not command or UNSET_PREFIX in command:
        return None
    if not NPM_RE.search(command):
        return None
    return NPM_RE.sub(UNSET_PREFIX, command)


def main() -> None:
    data = json.load(sys.stdin)
    tool_input = data.get("tool_input") or {}
    command = tool_input.get("command") or ""

    rewritten = rewrite_command(command)
    if rewritten is None:
        print(json.dumps({"permission": "allow"}))
        return

    updated_input = {**tool_input, "command": rewritten}
    print(json.dumps({"permission": "allow", "updated_input": updated_input}))


if __name__ == "__main__":
    main()
