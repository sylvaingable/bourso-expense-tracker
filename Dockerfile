FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim
WORKDIR /app
COPY . .
RUN uv sync --no-dev
EXPOSE 8501
CMD ["uv", "run", "--no-dev", "streamlit", "run", "app.py", "--server.address=0.0.0.0", "--browser.gatherUsageStats=false"]
