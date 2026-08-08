from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .presets import PRESETS
from .routers import accounts, messages

app = FastAPI(title="ping API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(messages.router)


@app.get("/presets")
def list_presets():
    return PRESETS


@app.get("/health")
def health():
    return {"status": "ok"}
