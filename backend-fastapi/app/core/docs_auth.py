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
    password = os.getenv("DOCS_PASSWORD", "")
    if not password:
        return JSONResponse({"error": "Not found"}, status_code=404)

    username = os.getenv("DOCS_USERNAME", "admin")
    credentials = await _basic(request)
    ok = credentials is not None and secrets.compare_digest(
        credentials.username.encode("utf-8"), username.encode("utf-8")
    ) and secrets.compare_digest(
        credentials.password.encode("utf-8"), password.encode("utf-8")
    )
    if ok:
        return None
    return Response(
        status_code=401,
        content="Login required",
        headers={"WWW-Authenticate": 'Basic realm="API docs", charset="UTF-8"'},
    )


def add_protected_docs(app: FastAPI) -> None:
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
