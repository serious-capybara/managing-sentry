from fastapi import APIRouter

router = APIRouter(tags=["test"])

@router.get("/test.php")
async def test():
    return {"status": "success", "message": "Server is working"}
