import re
import urllib.parse
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings


def clean_database_url(raw_url: str) -> str:
    url = raw_url.strip()
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    if "sqlite" in url:
        return url

    # Auto-encode special characters in password (e.g. '@', '#', '%')
    # Matches scheme://user:password@host[:port]/dbname
    match = re.match(
        r"^(?P<scheme>[a-zA-Z0-9_+]+://)(?P<user>[^:]+):(?P<pass>.+)@(?P<host>[^@/]+(?:/[^?]*)?(?:\?.*)?)$",
        url,
    )
    if match:
        scheme = match.group("scheme")
        user = match.group("user")
        password = match.group("pass")
        host_part = match.group("host")
        encoded_pass = urllib.parse.quote(urllib.parse.unquote(password), safe="")
        return f"{scheme}{user}:{encoded_pass}@{host_part}"

    return url


# Engine configuration
db_url = clean_database_url(settings.DATABASE_URL)

engine_kwargs = {"echo": False, "future": True}
if "sqlite" in db_url:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_async_engine(db_url, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
