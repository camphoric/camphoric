from django.urls import path
from rest_framework.routers import DefaultRouter

from camphoric import views

router = DefaultRouter()
router.register('organizations', views.OrganizationViewSet, basename='organization')
router.register('events', views.EventViewSet, basename='event')
router.register('registrations', views.RegistrationViewSet, basename='registration')
router.register('lodgings', views.LodgingViewSet, basename='lodging')
router.register('campers', views.CamperViewSet, basename='camper')
router.register('deposits', views.DepositViewSet, basename='deposit')
router.register('payments', views.PaymentViewSet, basename='payment')
urlpatterns = router.urls + [
    path('events/<int:event_id>/register', views.RegisterView.as_view())
]
