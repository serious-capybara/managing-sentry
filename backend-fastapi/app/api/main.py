from fastapi import FastAPI
from database.connection import lifespan
from routers import auth, test, products, history, sales

app = FastAPI(lifespan=lifespan)

app.include_router(auth.router)
app.include_router(test.router)
app.include_router(products.router)
app.include_router(history.router)
app.include_router(sales.router)


@app.get("/")
def read_root():
    return {"Hello": "World"}
