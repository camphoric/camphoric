'''
Encryption for secrets stored in the database (SMTP account passwords).

Values are Fernet tokens behind a `fernet:` prefix, so a value saved before
encryption (no prefix) still reads back as itself.
'''

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings

PREFIX = 'fernet:'

__all__ = ['InvalidToken', 'decrypt', 'encrypt', 'is_encrypted']


def _fernet():
    keys = [key.strip() for key in settings.CAMPHORIC_SECRET_KEY_EMAIL.split(',') if key.strip()]
    if not keys:
        digest = hashlib.sha256(f'camphoric-email:{settings.SECRET_KEY}'.encode()).digest()
        keys = [base64.urlsafe_b64encode(digest).decode()]
    # The first key encrypts; every key can decrypt, so keys can be rotated.
    return MultiFernet([Fernet(key) for key in keys])


def is_encrypted(value):
    return isinstance(value, str) and value.startswith(PREFIX)


def encrypt(value):
    return PREFIX + _fernet().encrypt(value.encode()).decode()


def decrypt(value):
    '''The plaintext; raises InvalidToken when no configured key can read it.'''
    if not is_encrypted(value):
        return value
    return _fernet().decrypt(value[len(PREFIX):].encode()).decode()
