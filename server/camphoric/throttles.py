'''
Throttles for signing in with a password (SPEC §6, DR-124): the client's
/api/login (the admin's, and the OAuth authorization page's) and the Django
admin's login page.

- Every sign-in POST counts against the client's address, at the `login` rate,
  so one address can't try many passwords or usernames.
- Every failed sign-in counts against the username tried, from any address, at
  the `login_username` rate, so many addresses can't share the guessing at one
  username. Only failures count, so signing in correctly never uses it up; but
  anyone who keeps failing at a username keeps its owner out too (DR-124).

And for apps using OAuth (camphoric.oauth, DR-146): requests to the token
endpoint count against the client's address at the `oauth_token` rate, and
requests whose access token isn't valid at the `oauth_bearer_failure` rate.
Requests whose personal access token isn't valid (camphoric.api_tokens, DR-157)
count apart, at the `api_token_failure` rate.
'''

import functools
import hashlib
import math
import unicodedata

from django.contrib.auth.signals import user_login_failed
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_protect
from rest_framework.throttling import SimpleRateThrottle


def normalized_username(username):
    '''
    A username as the throttle counts it: NFKC-normalized, as Django normalizes
    usernames, and casefolded, so look-alikes and other cases count together.
    '''
    return unicodedata.normalize('NFKC', str(username or '')).strip().casefold()


def submitted_username(request):
    '''The username a sign-in request tries, normalized; '' for none.'''
    data = getattr(request, 'data', None)  # a DRF request's parsed body
    if data is None:
        data = request.POST
    return normalized_username(data.get('username') if hasattr(data, 'get') else None)


class AddressPostThrottle(SimpleRateThrottle):
    '''POSTs from one client address (behind a proxy: NUM_PROXIES), at the `scope` rate.'''

    def get_cache_key(self, request, view):
        if request.method != 'POST':
            return None
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}


class LoginAddressThrottle(AddressPostThrottle):
    '''Sign-in POSTs from one client address.'''
    scope = 'login'


class OAuthTokenThrottle(AddressPostThrottle):
    '''Requests to the OAuth token and revocation endpoints from one client address.'''
    scope = 'oauth_token'


class FailureThrottle(SimpleRateThrottle):
    '''
    A throttle that only counts failures: it refuses a request once the failures
    recorded at the request's key (`key_for_request`) reach the rate, and
    `record_failure` adds one.
    '''

    def key_for_request(self, request):
        raise NotImplementedError

    def get_cache_key(self, request, view):
        return self.key_for_request(request)

    def recent(self, key):
        '''The failures at `key` still inside the window, newest first.'''
        self.now = self.timer()
        self.history = self.cache.get(key, [])
        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()
        return self.history

    def allow_request(self, request, view):
        if self.rate is None:
            return True
        key = self.get_cache_key(request, view)
        return key is None or len(self.recent(key)) < self.num_requests

    def record_failure_at(self, key):
        if self.rate is None or key is None:
            return
        history = self.recent(key)
        history.insert(0, self.now)
        self.cache.set(key, history, self.duration)


class LoginUsernameThrottle(FailureThrottle):
    '''
    Failed sign-ins at one username, from any address. It only checks: the
    failures are counted by record_failure, on Django's user_login_failed.
    '''
    scope = 'login_username'

    @classmethod
    def key_for(cls, username):
        username = normalized_username(username)
        if not username:
            return None
        # Hashed, so any username makes a valid cache key.
        ident = hashlib.sha256(username.encode()).hexdigest()
        return cls.cache_format % {'scope': cls.scope, 'ident': ident}

    def key_for_request(self, request):
        if request.method != 'POST':
            return None
        return self.key_for(submitted_username(request))

    def record_failure(self, username):
        self.record_failure_at(self.key_for(username))


class BearerFailureThrottle(FailureThrottle):
    '''Requests from one client address whose OAuth access token wasn't valid.'''
    scope = 'oauth_bearer_failure'

    def key_for_request(self, request):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}

    def record_failure(self, request):
        self.record_failure_at(self.key_for_request(request))


class ApiTokenFailureThrottle(BearerFailureThrottle):
    '''Requests from one client address whose personal access token wasn't valid.'''
    scope = 'api_token_failure'


def record_failure(sender, credentials, request=None, **kwargs):
    '''Count a failed sign-in against the username it tried (user_login_failed).'''
    LoginUsernameThrottle().record_failure(credentials.get('username'))


user_login_failed.connect(record_failure, dispatch_uid='camphoric.throttles.record_failure')


LOGIN_THROTTLES = [LoginAddressThrottle, LoginUsernameThrottle]

TOO_MANY_ATTEMPTS = 'Too many sign-in attempts. Try again later.'


def too_many_requests(throttles, request, message=TOO_MANY_ATTEMPTS):
    '''
    A 429 if any of the throttles refuses the request, or None. Every throttle
    is asked, as DRF does, so each one sees the attempt.
    '''
    throttles = [throttle() for throttle in throttles]
    waits = [throttle.wait() or 0 for throttle in throttles
             if not throttle.allow_request(request, None)]
    if not waits:
        return None
    response = HttpResponse(message, status=429, content_type='text/plain')
    response['Retry-After'] = str(math.ceil(max(waits)))
    return response


def throttle_login(view):
    '''
    A plain Django sign-in view, with the login throttles on its POSTs (a 429
    when over). The CSRF check comes first, so a refused POST isn't counted.
    '''
    @csrf_protect
    @functools.wraps(view)
    def throttled(request, *args, **kwargs):
        if request.method == 'POST':
            refused = too_many_requests(LOGIN_THROTTLES, request)
            if refused:
                return refused
        return view(request, *args, **kwargs)
    return throttled


def throttle_oauth_token(view):
    '''The OAuth token or revocation endpoint, with OAuthTokenThrottle on its POSTs.'''
    @functools.wraps(view)
    def throttled(request, *args, **kwargs):
        refused = too_many_requests(
            [OAuthTokenThrottle], request, 'Too many requests. Try again later.')
        return refused or view(request, *args, **kwargs)
    return throttled
