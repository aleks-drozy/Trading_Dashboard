from fastapi import APIRouter, Depends
from backend.dependencies import get_current_user

router = APIRouter()


@router.get("")
def list_watchlist(current_user: str = Depends(get_current_user)):
    """Placeholder — full implementation in plan 01-02."""
    return []
