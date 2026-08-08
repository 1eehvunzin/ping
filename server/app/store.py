import itertools
from datetime import datetime

from .presets import PRESETS_BY_CODE

_message_ids = itertools.count(1)


class StoreError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class Account:
    def __init__(self, id: str, password: str):
        self.id = id
        self.password = password
        self.known_senders: set[str] = set()
        self.inbox: list[dict] = []
        self.requests: list[dict] = []


class Store:
    """In-memory only — state resets on server restart."""

    def __init__(self):
        self.accounts: dict[str, Account] = {}

    def get(self, id: str) -> Account | None:
        return self.accounts.get(id)

    def register(self, id: str, password: str) -> Account:
        if id in self.accounts:
            raise StoreError("ID_TAKEN")
        account = Account(id, password)
        self.accounts[id] = account
        return account

    def login(self, id: str, password: str) -> Account:
        account = self.accounts.get(id)
        if not account:
            raise StoreError("NOT_FOUND")
        if account.password != password:
            raise StoreError("WRONG_PASSWORD")
        return account

    def reset_password(self, id: str, new_password: str) -> Account:
        account = self.accounts.get(id)
        if not account:
            raise StoreError("NOT_FOUND")
        account.password = new_password
        return account

    def send_message(self, from_id: str, to_id: str, code: str) -> dict:
        sender = self.accounts.get(from_id)
        recipient = self.accounts.get(to_id)
        if not sender:
            raise StoreError("SENDER_NOT_FOUND")
        if not recipient:
            raise StoreError("RECIPIENT_NOT_FOUND")
        meaning = PRESETS_BY_CODE.get(code)
        if meaning is None:
            raise StoreError("UNKNOWN_CODE")

        message = {
            "id": next(_message_ids),
            "from_id": from_id,
            "to_id": to_id,
            "code": code,
            "meaning": meaning,
            "time": datetime.now().strftime("%H:%M"),
            "read": False,
        }
        if from_id in recipient.known_senders:
            recipient.inbox = [message, *recipient.inbox][:9]
        else:
            recipient.requests = [message, *recipient.requests][:9]
        return message

    def approve_request(self, id: str, message_id: int) -> dict:
        account = self.accounts.get(id)
        if not account:
            raise StoreError("NOT_FOUND")
        message = next((m for m in account.requests if m["id"] == message_id), None)
        if not message:
            raise StoreError("REQUEST_NOT_FOUND")
        account.requests = [m for m in account.requests if m["id"] != message_id]
        account.known_senders.add(message["from_id"])
        approved = {**message, "read": False}
        account.inbox = [approved, *account.inbox][:9]
        return approved

    def decline_request(self, id: str, message_id: int) -> None:
        account = self.accounts.get(id)
        if not account:
            raise StoreError("NOT_FOUND")
        account.requests = [m for m in account.requests if m["id"] != message_id]

    def mark_read(self, id: str, message_id: int) -> None:
        account = self.accounts.get(id)
        if not account:
            raise StoreError("NOT_FOUND")
        for m in account.inbox:
            if m["id"] == message_id:
                m["read"] = True


store = Store()
