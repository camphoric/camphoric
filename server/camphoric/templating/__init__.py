'''
Server-side Jinja templating for reports and emails (SPEC §9.3, DR-35).

Templates render against a read-only graph of plain data built from the
database (`graph.py`), in a sandboxed Jinja environment (`env.py`). What each
kind of template receives is described once in `registry.py`; that
description drives the describe endpoint, editor autocomplete and the help
pages (`describe.py`).
'''
