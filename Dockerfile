# FinSage backend — runs on Render, Hugging Face Spaces, Koyeb or any container host (listens on $PORT).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PORT=7860

RUN useradd --create-home --uid 1000 app
WORKDIR /home/app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY --chown=app:app backend ./backend
USER app

# yfinance keeps a small cache in $HOME.
ENV HOME=/home/app LOCAL_LLM_URL=off
EXPOSE 7860
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
