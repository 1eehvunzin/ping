import os

from dotenv import load_dotenv
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


class AccountRow(Base):
    __tablename__ = "accounts"

    id = Column(String(16), primary_key=True)
    password = Column(Text, nullable=False)

    known_senders = relationship(
        "KnownSenderRow", back_populates="account", cascade="all, delete-orphan"
    )


class KnownSenderRow(Base):
    __tablename__ = "known_senders"
    __table_args__ = (UniqueConstraint("account_id", "sender_id"),)

    id = Column(Integer, primary_key=True)
    account_id = Column(String(16), ForeignKey("accounts.id"), nullable=False)
    sender_id = Column(String(16), nullable=False)

    account = relationship("AccountRow", back_populates="known_senders")


class MessageRow(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    from_id = Column(String(16), nullable=False)
    to_id = Column(String(16), nullable=False)
    code = Column(Text, nullable=False)
    meaning = Column(Text, nullable=False)
    time = Column(String(5), nullable=False)
    read = Column(Boolean, nullable=False, default=False)
    status = Column(Text, nullable=False)  # "inbox" | "request"


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_session() -> Session:
    return SessionLocal()
