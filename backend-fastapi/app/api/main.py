from fastapi import FastAPI
from core.docs_auth import add_protected_docs
from database.connection import lifespan
from routers import auth, test, products, history, sales

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

app.include_router(auth.router)
app.include_router(test.router)
app.include_router(products.router)
app.include_router(history.router)
app.include_router(sales.router)
add_protected_docs(app)


@app.get("/")
def read_root():
    return {"Hello": "World"}
