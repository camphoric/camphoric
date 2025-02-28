from django.urls import re_path
from . import views
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    re_path(r'^.*', views.FrontendBootstrapView.as_view())
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
