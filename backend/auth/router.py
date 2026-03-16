from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from backend.auth.service import verify_password, create_access_token
from backend.config import get_settings
from fastapi import HTTPException

router = APIRouter()


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    settings = get_settings()
    if form_data.username != settings.admin_email:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(form_data.password, settings.admin_password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(sub=form_data.username)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/logout")
def logout():
    return {"message": "Logged out"}
