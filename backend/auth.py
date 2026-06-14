from datetime import datetime, timedelta
from typing import Optional
import os
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import models, schemas, database

# Secret key to encode the JWT token
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-very-secret-key-that-should-be-in-env-file")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
ADMIN_EMAILS = [email.strip().lower() for email in os.getenv("ADMIN_EMAILS", "admin@edupredict.ai").split(",") if email.strip()]

# Use pbkdf2_sha256 for portability and to avoid bcrypt backend incompatibilities.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not verify_password(password, user.password):
        return False
    return user

def is_admin_user(user: models.User) -> bool:
    """Check if user is an admin based on email or user_id=1"""
    # For development: make user_id=1 (first registered user) an admin
    if user.id == 1:
        return True
    return user.email.lower() in ADMIN_EMAILS

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, is_admin: bool = False):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire, "is_admin": is_admin})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise credentials_exception
        token_data = schemas.TokenData(user_id=int(user_id_raw))
    except JWTError:
        raise credentials_exception
    except (TypeError, ValueError):
        raise credentials_exception
    user = await run_in_threadpool(
        lambda: db.query(models.User).filter(models.User.id == token_data.user_id).first()
    )
    if user is None:
        raise credentials_exception
    # Attach admin status to user object
    user.is_admin = is_admin_user(user)
    return user

async def get_current_admin_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    """Get current user and verify they are an admin"""
    user = await get_current_user(token, db)
    if not is_admin_user(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return user
