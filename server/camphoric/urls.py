from django.urls import path
from rest_framework.routers import DefaultRouter

from camphoric import views


router = DefaultRouter()
router.register(r'organizations', views.OrganizationViewSet, basename='organization')
router.register(r'events', views.EventViewSet, basename='event')
router.register(r'registrations', views.RegistrationViewSet, basename='registration')
router.register(r'lodgings', views.LodgingViewSet, basename='lodging')
router.register(r'campers', views.CamperViewSet, basename='camper')
router.register(r'deposits', views.DepositViewSet, basename='deposit')
router.register(r'payments', views.PaymentViewSet, basename='payment')
urlpatterns = router.urls
