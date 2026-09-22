from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter used across the website's public endpoints
# (checkout, coupon validation, order tracking, account login/register).
limiter = Limiter(key_func=get_remote_address)
