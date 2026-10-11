from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware
from core import config
from database.connection import lifespan
from routers import auth, test, products, history, sales, capital, reset, maintenance

app = FastAPI(title="Inventory & Sales API", lifespan=lifespan)

# Signed session cookie (replaces PHP sessions)
app.add_middleware(
    SessionMiddleware,
    secret_key=config.SECRET_KEY,
    session_cookie="session",
    max_age=None,
    same_site="lax",
    https_only=config.SESSION_HTTPS_ONLY,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# The web frontend reads {"error": "..."} (the old PHP format), so errors are returned that way.
@app.exception_handler(StarletteHTTPException)
async def http_error(request, exc):
    return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse({"error": "Invalid request"}, status_code=400)


app.include_router(auth.router)
app.include_router(test.router)
app.include_router(products.router)
app.include_router(history.router)
app.include_router(sales.router)
app.include_router(capital.router)
app.include_router(reset.router)
app.include_router(maintenance.router)


@app.get("/")
def read_root():
    return {"Hello": "World"}

# reload trigger
