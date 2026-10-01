from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User

from . import roles
from .models import (
    Camper, Deposit, EmailMessage, Event, Lodging, Payment, PromoCode, Registration,
    WorkerHeartbeat,
)

admin.site.register(Event)
admin.site.register(Lodging)
admin.site.register(Deposit)


class DeletedFilter(admin.SimpleListFilter):
    title = 'deleted'
    parameter_name = 'deleted'

    def lookups(self, request, model_admin):
        return [('no', 'Not deleted'), ('yes', 'Deleted')]

    def queryset(self, request, queryset):
        if self.value() in ('no', 'yes'):
            return queryset.filter(deleted_at__isnull=self.value() == 'no')
        return queryset


class SoftDeletedAdmin(admin.ModelAdmin):
    '''
    Registrations, campers, payments and promo codes, deleted or not (SPEC DR-55): the admin
    API soft-deletes them, and their default manager hides deleted ones.
    '''
    list_display = ['__str__', 'deleted_at']
    list_filter = [DeletedFilter]
    readonly_fields = ['deleted_at']

    def get_queryset(self, request):
        return self.model.all_objects.all()


admin.site.register(Registration, SoftDeletedAdmin)
admin.site.register(Camper, SoftDeletedAdmin)
admin.site.register(Payment, SoftDeletedAdmin)
admin.site.register(PromoCode, SoftDeletedAdmin)


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


admin.site.unregister(User)


@admin.register(User)
class CamphoricUserAdmin(UserAdmin):
    '''Django's user admin, showing each user's Camphoric permission group (SPEC DR-50).'''
    list_display = [*UserAdmin.list_display, 'camphoric_permission_group']

    @admin.display(description='Camphoric permission group')
    def camphoric_permission_group(self, user):
        role = roles.role_of(user)
        return roles.GROUP_NAMES[role] if role else 'No access'
