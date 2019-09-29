from django.urls import path
from rest_framework.authtoken.views import obtain_auth_token

from camphoric import views


urlpatterns = [
    path('test/', views.test),
    path('login/', obtain_auth_token),
]
