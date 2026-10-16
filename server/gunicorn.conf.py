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
# A platform that sets PORT (a Procfile host) gets that port.
bind = f'0.0.0.0:{os.environ.get("PORT", "8000")}'
accesslog = '-'
errorlog = '-'
