import os

from django.views.generic import View
from django.http import HttpResponse
from django.conf import settings


class FrontendBootstrapView(View):
    """
    Serves the compiled frontend entry point (only works if you have run `yarn
    run build`).
    """

    def get(self, request):
        try:
            with open(os.path.join(settings.REACT_BUILD_DIR, 'index.html')) as f:
                response = HttpResponse(f.read())
            # The unsubscribe page names the recipient's address (SPEC DR-154).
            if request.path.startswith('/unsubscribe/'):
                response['X-Robots-Tag'] = 'noindex'
            return response
        except FileNotFoundError:
            return HttpResponse(
                """
        This URL is only used when you have built the production
        version of the app. Run `npm run build` to test the
        production version.
        """,
                status=501,
            )
