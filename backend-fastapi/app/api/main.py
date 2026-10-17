from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware
from core import config
from core.docs_auth import add_protected_docs
from database.connection import lifespan
from routers import auth, health, products, history, sales, reset

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

app.add_middleware(
    SessionMiddleware,
    secret_key=config.SECRET_KEY,
    session_cookie="session",
    max_age=None,
    same_site="lax",
    https_only=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router)
app.include_router(health.router)
app.include_router(products.router)
app.include_router(history.router)
app.include_router(sales.router)
app.include_router(reset.router)
add_protected_docs(app)


@app.get("/")
def read_root():
    return {"Hello": "World"}
