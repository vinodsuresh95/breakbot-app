FROM python:3.13-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi==0.115.6 "uvicorn[standard]==0.34.0" anthropic==0.42.0 python-dotenv==1.0.1
COPY app.py knowledge_base.py ./
ENV HOST=0.0.0.0 PORT=8080 TARGET_MODE=vulnerable
EXPOSE 8080
CMD ["python", "app.py"]
