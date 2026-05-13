# expense-tracker

Personal expense tracker for BoursoBank CSV exports. Ingests a multi-account export, drops internal transfers and aggregated debits, applies user-defined ignore rules, and renders a monthly income/expenses overview with per-month drill-down.

> Vibecoded with [Claude Code](https://claude.ai/code).

## Stack

- Python 3.13, [uv](https://docs.astral.sh/uv/)
- [Streamlit](https://streamlit.io/) — UI
- [Plotly](https://plotly.com/python/) — charts

## Quickstart

```bash
uv run streamlit run app.py
```

Then open `http://localhost:8501` and upload your BoursoBank CSV export.

## Deployment

### Self-hosted with Docker

A `Dockerfile` is included in the repo.

```bash
docker build -t expense-tracker .
touch ignore_rules.json   # must exist before mounting, or Docker creates a directory
docker run -p 8501:8501 -v ./ignore_rules.json:/app/ignore_rules.json expense-tracker
```

### Fly.io / Railway / Render

Any platform that runs a Docker container or a `uv`-managed Python app will work. Set the start command to `uv run streamlit run app.py --server.address=0.0.0.0 --server.port=$PORT`.

## Data privacy

The CSV contains real banking data. Don't commit it, don't paste it into external services, and prefer self-hosted deployment if privacy matters.
