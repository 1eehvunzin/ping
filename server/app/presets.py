"""Preset pager codes, kept in sync with frontend/src/pager/data.ts."""

PRESETS: list[dict[str, str]] = [
    {"code": "0404", "meaning": "영원히 사랑해"},
    {"code": "045", "meaning": "빵사와"},
    {"code": "07209", "meaning": "땡칠이 영구"},
    {"code": "0909", "meaning": "모든것이 취소됐다"},
    {"code": "0929", "meaning": "볼링장 가자"},
    {"code": "100", "meaning": "돌아와 (BACK)"},
    {"code": "100003", "meaning": "만세"},
    {"code": "1000024", "meaning": "만이 사랑해"},
    {"code": "1008", "meaning": "난 지금 고민스러워"},
    {"code": "1010235", "meaning": "열렬히 사모해"},
    {"code": "1052", "meaning": "사랑해"},
    {"code": "108", "meaning": "괴롭다, 고민 중이다"},
    {"code": "11", "meaning": "나란히 있고 싶어요"},
    {"code": "11010", "meaning": "흥!"},
    {"code": "112", "meaning": "긴급상황"},
    {"code": "1142", "meaning": "전화하지마"},
    {"code": "11555", "meaning": "이리로 와요"},
    {"code": "1255", "meaning": "내가 있는 곳으로 오시오"},
    {"code": "1350", "meaning": "너없이는 못살겠다"},
    {"code": "1414", "meaning": "식사나 함께 합시다"},
    {"code": "1472", "meaning": "일이 잘되고 있다"},
    {"code": "1717", "meaning": "일찍 오세요"},
    {"code": "175", "meaning": "일찍와"},
    {"code": "1750", "meaning": "일찍오렴"},
]

PRESETS_BY_CODE: dict[str, str] = {p["code"]: p["meaning"] for p in PRESETS}
