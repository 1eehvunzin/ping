from fastapi import APIRouter, HTTPException

from ..schemas import AccountOut, LoginRequest, RegisterRequest
from ..store import StoreError, store

router = APIRouter(prefix="/accounts", tags=["accounts"])

_ERROR_STATUS = {
    "ID_TAKEN": 409,
    "NOT_FOUND": 404,
    "WRONG_PASSWORD": 401,
}


def _raise(err: StoreError) -> None:
    raise HTTPException(status_code=_ERROR_STATUS.get(err.code, 400), detail=err.code)


def _out(account) -> AccountOut:
    return AccountOut(id=account.id, known_senders=sorted(account.known_senders))


@router.post("/register", response_model=AccountOut, status_code=201)
def register(body: RegisterRequest):
    try:
        account = store.register(body.id.upper(), body.password)
    except StoreError as e:
        _raise(e)
    return _out(account)


@router.post("/login", response_model=AccountOut)
def login(body: LoginRequest):
    try:
        account = store.login(body.id.upper(), body.password)
    except StoreError as e:
        _raise(e)
    return _out(account)


@router.get("/{id}", response_model=AccountOut)
def get_account(id: str):
    account = store.get(id.upper())
    if not account:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    return _out(account)
