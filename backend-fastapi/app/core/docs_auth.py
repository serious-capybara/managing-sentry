"""Password protection for the FastAPI documentation pages.

The docs (/docs, /redoc and /openapi.json) show every endpoint of the API, so they are
locked behind a browser login prompt (HTTP Basic authentication).

Set these two environment variables (in .env locally, or in the Vercel project settings):
    DOCS_USERNAME   the login name   (default: admin)
    DOCS_PASSWORD   the password     (no default)

If DOCS_PASSWORD is not set, the docs are switched OFF completely (404), so they can never
be left open by accident.
"""
import os
import secrets

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPBasic

load_dotenv()

_basic = HTTPBasic(auto_error=False)


async def _guard(request: Request) -> Response | None:
    """Return a response that blocks the request, or None when the login is correct."""
    password = os.getenv("DOCS_PASSWORD", "")
    if not password:
        return JSONResponse({"error": "Not found"}, status_code=404)

    username = os.getenv("DOCS_USERNAME", "admin")
    credentials = await _basic(request)
    # compare_digest takes the same time however many characters match (no timing leaks)
    ok = credentials is not None and secrets.compare_digest(
        credentials.username.encode("utf-8"), username.encode("utf-8")
    ) and secrets.compare_digest(
        credentials.password.encode("utf-8"), password.encode("utf-8")
    )
    if ok:
        return None
    # The WWW-Authenticate header is what makes the browser show its login box.
    return Response(
        status_code=401,
        content="Login required",
        headers={"WWW-Authenticate": 'Basic realm="API docs", charset="UTF-8"'},
    )


def add_protected_docs(app: FastAPI) -> None:
    """Add password-protected /docs, /redoc and /openapi.json (also under /api/...).

    Create the app with docs_url=None, redoc_url=None and openapi_url=None first,
    so FastAPI's own open copies are switched off.
    """
    title = app.title or "API"

    for prefix in ("", "/api"):
        openapi_path = f"{prefix}/openapi.json"

        def make_routes(openapi_path: str = openapi_path, prefix: str = prefix) -> None:
            @app.get(openapi_path, include_in_schema=False)
            async def openapi_json(request: Request):
                return await _guard(request) or JSONResponse(app.openapi())

            @app.get(f"{prefix}/docs", include_in_schema=False)
            async def swagger_docs(request: Request):
                return await _guard(request) or get_swagger_ui_html(
                    openapi_url=openapi_path, title=f"{title} - Swagger UI"
                )

            @app.get(f"{prefix}/redoc", include_in_schema=False)
            async def redoc_docs(request: Request):
                return await _guard(request) or get_redoc_html(
                    openapi_url=openapi_path, title=f"{title} - ReDoc"
                )

        make_routes()
