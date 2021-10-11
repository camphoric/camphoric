from django.urls import path
from rest_framework.routers import DefaultRouter

from camphoric import views

router = DefaultRouter()

router.register('organizations', views.OrganizationViewSet, basename='organization')
router.register('events', views.EventViewSet, basename='event')
router.register('registrations', views.RegistrationViewSet, basename='registration')
router.register('registrationtypes', views.RegistrationTypeViewSet, basename='registrationtype')
router.register('invitations', views.InvitationViewSet, basename='invitation')
router.register('lodgings', views.LodgingViewSet, basename='lodging')
router.register('campers', views.CamperViewSet, basename='camper')
router.register('deposits', views.DepositViewSet, basename='deposit')
router.register('payments', views.PaymentViewSet, basename='payment')

urlpatterns = router.urls + [
    path('set-csrf-cookie', views.SetCSRFCookieView.as_view()),
    path('login', views.LoginView.as_view()),
    path('logout', views.LogoutView.as_view()),
    path(
        'events/<int:event_id>/register', 
        views.RegisterView.as_view(),
        name='register',
    ),
    path('invitations/<int:invitation_id>/send', views.SendInvitationView.as_view()),
]
