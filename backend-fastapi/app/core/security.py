import bcrypt


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(rounds=12),
    ).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    normalized_hash = password_hash
    if normalized_hash.startswith("$2y$"):
        normalized_hash = "$2b$" + normalized_hash[4:]

    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            normalized_hash.encode("utf-8"),
        )
    except ValueError:
        return False
