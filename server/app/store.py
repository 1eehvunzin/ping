from datetime import datetime

from .db import AccountRow, KnownSenderRow, MessageRow, get_session
from .presets import PRESETS_BY_CODE


class StoreError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class Account:
    def __init__(
        self,
        id: str,
        password: str,
        known_senders: set[str],
        inbox: list[dict],
        requests: list[dict],
    ):
        self.id = id
        self.password = password
        self.known_senders = known_senders
        self.inbox = inbox
        self.requests = requests


def _message_out(row: MessageRow) -> dict:
    return {
        "id": row.id,
        "from_id": row.from_id,
        "to_id": row.to_id,
        "code": row.code,
        "meaning": row.meaning,
        "time": row.time,
        "read": row.read,
    }


def _load_account(session, id: str) -> Account | None:
    row = session.get(AccountRow, id)
    if not row:
        return None
    known_senders = {
        r.sender_id
        for r in session.query(KnownSenderRow).filter_by(account_id=id).all()
    }
    inbox = [
        _message_out(m)
        for m in session.query(MessageRow)
        .filter_by(to_id=id, status="inbox")
        .order_by(MessageRow.id.desc())
        .limit(9)
        .all()
    ]
    requests = [
        _message_out(m)
        for m in session.query(MessageRow)
        .filter_by(to_id=id, status="request")
        .order_by(MessageRow.id.desc())
        .limit(9)
        .all()
    ]
    return Account(row.id, row.password, known_senders, inbox, requests)


class Store:
    """Backed by Postgres (Supabase) — state persists across restarts."""

    def get(self, id: str) -> Account | None:
        with get_session() as s:
            return _load_account(s, id)

    def register(self, id: str, password: str) -> Account:
        with get_session() as s:
            if s.get(AccountRow, id):
                raise StoreError("ID_TAKEN")
            s.add(AccountRow(id=id, password=password))
            s.commit()
            return _load_account(s, id)

    def login(self, id: str, password: str) -> Account:
        with get_session() as s:
            row = s.get(AccountRow, id)
            if not row:
                raise StoreError("NOT_FOUND")
            if row.password != password:
                raise StoreError("WRONG_PASSWORD")
            return _load_account(s, id)

    def send_message(self, from_id: str, to_id: str, code: str) -> dict:
        with get_session() as s:
            sender = s.get(AccountRow, from_id)
            recipient = s.get(AccountRow, to_id)
            if not sender:
                raise StoreError("SENDER_NOT_FOUND")
            if not recipient:
                raise StoreError("RECIPIENT_NOT_FOUND")
            meaning = PRESETS_BY_CODE.get(code)
            if meaning is None:
                raise StoreError("UNKNOWN_CODE")

            is_known = (
                s.query(KnownSenderRow)
                .filter_by(account_id=to_id, sender_id=from_id)
                .first()
                is not None
            )
            row = MessageRow(
                from_id=from_id,
                to_id=to_id,
                code=code,
                meaning=meaning,
                time=datetime.now().strftime("%H:%M"),
                read=False,
                status="inbox" if is_known else "request",
            )
            s.add(row)
            s.commit()
            s.refresh(row)
            return _message_out(row)

    def approve_request(self, id: str, message_id: int) -> dict:
        with get_session() as s:
            account = s.get(AccountRow, id)
            if not account:
                raise StoreError("NOT_FOUND")
            row = (
                s.query(MessageRow)
                .filter_by(id=message_id, to_id=id, status="request")
                .first()
            )
            if not row:
                raise StoreError("REQUEST_NOT_FOUND")
            row.status = "inbox"
            row.read = False
            already_known = (
                s.query(KnownSenderRow)
                .filter_by(account_id=id, sender_id=row.from_id)
                .first()
                is not None
            )
            if not already_known:
                s.add(KnownSenderRow(account_id=id, sender_id=row.from_id))
            s.commit()
            s.refresh(row)
            return _message_out(row)

    def decline_request(self, id: str, message_id: int) -> None:
        with get_session() as s:
            account = s.get(AccountRow, id)
            if not account:
                raise StoreError("NOT_FOUND")
            row = (
                s.query(MessageRow)
                .filter_by(id=message_id, to_id=id, status="request")
                .first()
            )
            if row:
                s.delete(row)
                s.commit()

    def mark_read(self, id: str, message_id: int) -> None:
        with get_session() as s:
            account = s.get(AccountRow, id)
            if not account:
                raise StoreError("NOT_FOUND")
            row = (
                s.query(MessageRow)
                .filter_by(id=message_id, to_id=id, status="inbox")
                .first()
            )
            if row:
                row.read = True
                s.commit()


store = Store()
