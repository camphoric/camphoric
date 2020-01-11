from django.contrib import admin
from .models import Event, Registration, Lodging, Camper, Deposit, Payment, Organization

admin.site.register(Event)
admin.site.register(Registration)
admin.site.register(Lodging)
admin.site.register(Camper)
admin.site.register(Deposit)
admin.site.register(Payment)
admin.site.register(Organization)
