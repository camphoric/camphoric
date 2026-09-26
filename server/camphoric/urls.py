from django.urls import path
from rest_framework.routers import DefaultRouter

from camphoric import views
from camphoric.templating import views as template_views

router = DefaultRouter()

router.register('organizations', views.OrganizationViewSet, basename='organization')
router.register('emailaccounts', views.EmailAccountViewSet, basename='emailaccount')
router.register('events', views.EventViewSet, basename='event')
router.register('registrations', views.RegistrationViewSet, basename='registration')
router.register('registrationtypes', views.RegistrationTypeViewSet, basename='registrationtype')
router.register('reports', views.ReportViewSet, basename='report')
router.register('invitations', views.InvitationViewSet, basename='invitation')
router.register('lodgings', views.LodgingViewSet, basename='lodging')
router.register('campers', views.CamperViewSet, basename='camper')
router.register('deposits', views.DepositViewSet, basename='deposit')
router.register('payments', views.PaymentViewSet, basename='payment')
router.register('customcharges', views.CustomChargeViewSet, basename='customcharge')
router.register('customchargetypes', views.CustomChargeTypeViewSet, basename='customchargetype')
router.register('bulkemailtasks', views.BulkEmailTaskViewSet, basename='bulkemailtask')
router.register(
    'bulkemailrecipients', views.BulkEmailRecipientViewSet, basename='bulkemailrecipient')
router.register('emailtemplates', views.EmailTemplateViewSet, basename='emailtemplate')
router.register('emailmessages', views.EmailMessageViewSet, basename='emailmessage')
router.register('users', views.UserViewSet, basename='user')


urlpatterns = router.urls + [
    path('set-csrf-cookie', views.SetCSRFCookieView.as_view()),
    path('login', views.LoginView.as_view()),
    path('user', views.UserView.as_view()),
    path('logout', views.LogoutView.as_view()),
    path(
        'events/<int:event_id>/register',
        views.RegisterView.as_view(),
        name='register',
    ),
    path(
        'eventlist',
        views.EventList.as_view(),
        name='eventlist',
    ),
    path('invitations/<int:invitation_id>/send', views.SendInvitationView.as_view()),
    path(
        'events/<int:event_id>/lodgingschema',
        views.LodgingSchemaView.as_view(),
        name='lodgingschema',
    ),
    path('bulkemailtasks/<int:task_id>/send', views.SendBulkEmailView.as_view()),
    path('bulkemailtasks/<int:task_id>/test', views.TestBulkEmailView.as_view()),
    path('bulkemailtasks/<int:task_id>/recipients/resolve',
         views.ResolveBulkEmailRecipientsView.as_view()),
    path('events/<int:event_id>/bulkemail/recipients',
         views.BulkEmailRecipientsPreviewView.as_view()),
    path('bulkemailtasks/<int:task_id>/cancel', views.CancelBulkEmailView.as_view()),
    path('reports/<int:report_id>/render', views.RenderReportView.as_view()),
    path('events/<int:event_id>/email/queue', views.EmailQueueView.as_view()),
    path(
        'events/<int:event_id>/templates/describe',
        template_views.TemplateDescribeView.as_view(),
        name='template-describe',
    ),
    path(
        'events/<int:event_id>/templates/check',
        template_views.TemplateCheckView.as_view(),
        name='template-check',
    ),
    path(
        'events/<int:event_id>/templates/preview',
        template_views.TemplatePreviewView.as_view(),
        name='template-preview',
    ),
]
