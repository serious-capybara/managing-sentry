from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
@router.get("/test.php", include_in_schema=False)
async def health():
    return {"status": "success", "message": "Server is working"}
