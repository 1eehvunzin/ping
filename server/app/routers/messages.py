from fastapi import APIRouter, HTTPException, Response

from ..schemas import MessageOut, SendMessageRequest
from ..store import StoreError, store

router = APIRouter(prefix="/messages", tags=["messages"])

_ERROR_STATUS = {
    "SENDER_NOT_FOUND": 404,
    "RECIPIENT_NOT_FOUND": 404,
    "UNKNOWN_CODE": 422,
    "NOT_FOUND": 404,
    "REQUEST_NOT_FOUND": 404,
}


def _raise(err: StoreError) -> None:
    raise HTTPException(status_code=_ERROR_STATUS.get(err.code, 400), detail=err.code)


@router.post("/send", response_model=MessageOut, status_code=201)
def send_message(body: SendMessageRequest):
    try:
        return store.send_message(body.from_id.upper(), body.to_id.upper(), body.code)
    except StoreError as e:
        _raise(e)


@router.get("/{id}/inbox", response_model=list[MessageOut])
def get_inbox(id: str):
    account = store.get(id.upper())
    if not account:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    return account.inbox


@router.get("/{id}/requests", response_model=list[MessageOut])
def get_requests(id: str):
    account = store.get(id.upper())
    if not account:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    return account.requests


@router.post("/{id}/requests/{message_id}/approve", response_model=MessageOut)
def approve_request(id: str, message_id: int):
    try:
        return store.approve_request(id.upper(), message_id)
    except StoreError as e:
        _raise(e)


@router.post("/{id}/requests/{message_id}/decline", status_code=204)
def decline_request(id: str, message_id: int):
    try:
        store.decline_request(id.upper(), message_id)
    except StoreError as e:
        _raise(e)
    return Response(status_code=204)


@router.post("/{id}/inbox/{message_id}/read", status_code=204)
def mark_read(id: str, message_id: int):
    try:
        store.mark_read(id.upper(), message_id)
    except StoreError as e:
        _raise(e)
    return Response(status_code=204)
