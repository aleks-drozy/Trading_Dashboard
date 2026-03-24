from sqlmodel import SQLModel, Session, create_engine
from backend.config import get_settings


def _make_engine():
    settings = get_settings()
    return create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
    )


# Engine is created lazily on first access
_engine = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = _make_engine()
    return _engine


# For backwards compat / conftest overrides
engine = property(get_engine)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(get_engine())


def get_session():
    from sqlmodel import Session
    with Session(get_engine()) as session:
        yield session
