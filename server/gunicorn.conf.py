'''
gunicorn's settings for the web server (CONTAINER.md, SPEC DR-111). gunicorn
reads this file from its working directory; GUNICORN_CMD_ARGS overrides any of
it, and the command line overrides both — so these are only defaults.
'''

import os

wsgi_app = 'camphoric_server.asgi:application'
# Django's ASGI app on uvicorn's workers.
worker_class = 'uvicorn_worker.UvicornWorker'
workers = 3
# Seconds an idle keep-alive connection stays open (uvicorn's timeout_keep_alive).
# Longer than a client keeps one for reuse, or the client can send a request on
# a connection as the server closes it ("other side closed"): Node's fetch keeps
# them 4 s, and uvicorn doesn't tell it the server's limit. gunicorn's default is
# 2. A proxy that reuses connections to the app must drop them sooner than this.
keepalive = 5
# A platform that sets PORT (a Procfile host) gets that port.
bind = f'0.0.0.0:{os.environ.get("PORT", "8000")}'
accesslog = '-'
errorlog = '-'
