from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter used across the website's public endpoints
# (checkout, cart quotes, order tracking, account login/register).
limiter = Limiter(key_func=get_remote_address)
