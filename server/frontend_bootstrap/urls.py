from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from . import views

bootstrap_paths = ['', 'register', 'success']

urlpatterns = [
  path(bootstrap_path, views.FrontendBootstrapView.as_view()) 
    for bootstrap_path in bootstrap_paths
]
