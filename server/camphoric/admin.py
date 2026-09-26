from django.contrib import admin
from .models import (
    Camper, Deposit, EmailMessage, Event, Lodging, Payment, Registration, WorkerHeartbeat,
)

admin.site.register(Event)
admin.site.register(Registration)
admin.site.register(Lodging)
admin.site.register(Camper)
admin.site.register(Deposit)
admin.site.register(Payment)


@admin.register(EmailMessage)
class EmailMessageAdmin(admin.ModelAdmin):
    '''The email outbox, read-only: messages are queued and updated by the app.'''
    list_display = ['created_at', 'kind', 'to', 'subject', 'status', 'attempts', 'sent_at']
    list_filter = ['status', 'kind', 'event']
    search_fields = ['to', 'subject']
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(WorkerHeartbeat)
class WorkerHeartbeatAdmin(admin.ModelAdmin):
    list_display = ['worker_id', 'hostname', 'pid', 'started_at', 'seen_at']
