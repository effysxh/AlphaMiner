from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.scenario import router as scenario_router
from app.api.factor_pool import router as factor_pool_router
from app.api.factor import router as factor_router
from app.api.reward import router as reward_router

app = FastAPI(title="TQ Factor Mining Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scenario_router, prefix="/api/v1")
app.include_router(factor_pool_router, prefix="/api/v1")
app.include_router(factor_router, prefix="/api/v1")
app.include_router(reward_router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
