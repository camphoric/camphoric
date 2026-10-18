'''
Registration takes only the lodging its form offers (#795): this event's, shown,
a final choice, and not full. As on the form, a registration's own campers may
fill the last places past capacity. Registrations for the same lodging take
turns, so two can't both have the last bed. Admins may still overbook.
'''

import threading
from unittest import mock

from django.db import connection
from django.test import TransactionTestCase
from rest_framework.test import APIClient, APITestCase

from camphoric import lodging, models, roles, views
from tests.factories import make_user
from tests.test_views import create_standard_test_event

ERROR_KEY = 'campers.{}.lodging.lodging_requested.id'


def build_lodging(test):
    '''A root with a cabin area of two one-bed cabins, and a ten-place tent.'''
    event = test.event
    test.root = event.lodging_set.create(name='Lodging', visible=True)
    test.cabins = event.lodging_set.create(name='Cabins', parent=test.root, visible=True)
    test.cabin_a = event.lodging_set.create(
        name='Cabin A', parent=test.cabins, visible=True, capacity=1)
    test.cabin_b = event.lodging_set.create(
        name='Cabin B', parent=test.cabins, visible=True, capacity=1)
    test.tent = event.lodging_set.create(
        name='Tent', parent=test.root, visible=True, capacity=10)


def form_data(test, *lodgings):
    '''The test event's form data with a camper per lodging (None: no lodging).'''
    campers = []
    for index, chosen in enumerate(lodgings):
        camper = {'name': f'Camper {index}'}
        if chosen is not None:
            camper['lodging'] = {
                'lodging_requested': {'id': chosen.id, 'choices': [chosen.id]},
            }
        campers.append(camper)
    return {**test.valid_form_data, 'campers': campers}


def register(client, test, *lodgings):
    return client.post(
        f'/api/events/{test.event.id}/register',
        {'formData': form_data(test, *lodgings), 'pricingResults': {}},
        format='json')


class RegisterLodgingTests(APITestCase):
    def setUp(self):
        create_standard_test_event(self)
        build_lodging(self)

    def register(self, *lodgings):
        return register(self.client, self, *lodgings)

    def assertRefused(self, response, camper_index, message):
        self.assertEqual(response.status_code, 400, response.data)
        [error] = response.data[ERROR_KEY.format(camper_index)]
        self.assertRegex(str(error), message)

    def test_lodging_with_room_is_taken(self):
        response = self.register(self.cabin_a, self.tent)
        self.assertEqual(response.status_code, 200, response.data)
        campers = models.Camper.objects.order_by('sequence')
        self.assertEqual([c.lodging_id for c in campers], [self.cabin_a.id, self.tent.id])
        self.assertEqual([c.lodging_requested_id for c in campers],
                         [self.cabin_a.id, self.tent.id])

    def test_campers_without_lodging_need_no_room(self):
        response = self.register(None, None)
        self.assertEqual(response.status_code, 200, response.data)

    def test_full_lodging_is_refused_and_nothing_is_saved(self):
        self.assertEqual(self.register(self.cabin_a).status_code, 200)
        response = self.register(self.tent, self.cabin_a)
        self.assertRefused(response, 1, 'no room left in Cabin A')
        self.assertEqual(models.Registration.objects.count(), 1)
        self.assertEqual(models.Camper.objects.count(), 1)

    def test_lodging_marked_full_is_refused(self):
        self.tent.availability = models.LodgingAvailability.FULL
        self.tent.save()
        self.assertRefused(self.register(self.tent), 0, 'no room left in Tent')

    def test_lodging_under_a_full_choice_is_refused(self):
        self.cabins.availability = models.LodgingAvailability.FULL
        self.cabins.save()
        self.assertRefused(self.register(self.cabin_a), 0, 'no room left in Cabins')

    def test_lodging_marked_open_takes_campers_past_its_capacity(self):
        self.cabin_a.availability = models.LodgingAvailability.OPEN
        self.cabin_a.save()
        response = self.register(self.cabin_a, self.cabin_a, self.cabin_a)
        self.assertEqual(response.status_code, 200, response.data)

    def test_a_party_may_fill_the_last_places_past_capacity_as_the_form_allows(self):
        # Campouts count RV and tent spots, which a party shares: a party of three in
        # a one-bed cabin is taken, as the form (which shows it free) allows.
        response = self.register(self.cabin_a, self.cabin_a, self.cabin_a)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertRefused(self.register(self.cabin_a), 0, 'no room left in Cabin A')

    def test_a_full_choice_above_the_lodging_refuses_it(self):
        # One place in Cabins, though each cabin has a bed: once a camper has it,
        # Cabins is full and the other cabin is refused under it.
        self.cabins.capacity = 1
        self.cabins.save()
        self.assertEqual(self.register(self.cabin_a).status_code, 200)
        self.assertRefused(self.register(self.cabin_b), 0, 'no room left in Cabins')

    def test_sharing_multiplier_counts_as_the_tree_counts(self):
        self.tent.capacity = 2
        self.tent.sharing_multiplier = 1.5
        self.tent.save()
        # 1.5 of 2 taken leaves room; 3 of 2 leaves none.
        self.assertEqual(self.register(self.tent).status_code, 200)
        self.assertEqual(self.register(self.tent).status_code, 200)
        self.assertRefused(self.register(self.tent), 0, 'no room left in Tent')

    def test_a_choice_with_choices_under_it_is_not_final(self):
        self.assertRefused(self.register(self.cabins), 0, 'isn\'t available')

    def test_a_choice_whose_choices_are_hidden_is_final(self):
        self.cabin_a.visible = False
        self.cabin_a.save()
        self.cabin_b.visible = False
        self.cabin_b.save()
        self.assertEqual(self.register(self.cabins).status_code, 200)

    def test_the_last_bed_goes_to_the_first_registration(self):
        self.assertEqual(self.register(self.cabin_a).status_code, 200)
        self.assertRefused(self.register(self.cabin_a), 0, 'no room left in Cabin A')
        self.assertEqual(self.register(self.cabin_b).status_code, 200)

    def test_hidden_lodging_is_refused(self):
        self.cabin_a.visible = False
        self.cabin_a.save()
        self.assertRefused(self.register(self.cabin_a), 0, 'isn\'t available')

    def test_lodging_under_a_hidden_choice_is_refused(self):
        self.cabins.visible = False
        self.cabins.save()
        self.assertRefused(self.register(self.cabin_a), 0, 'isn\'t available')

    def test_the_root_is_not_a_choice(self):
        self.assertRefused(self.register(self.root), 0, 'isn\'t available')

    def other_events_lodging(self):
        other_event = models.Event.objects.create(
            organization=self.organization, name='Another event')
        other_root = other_event.lodging_set.create(name='Elsewhere', visible=True)
        return other_event.lodging_set.create(
            name='Other tent', parent=other_root, visible=True, capacity=10)

    def test_another_events_lodging_is_refused(self):
        other_tent = self.other_events_lodging()
        self.assertRefused(self.register(self.tent, other_tent), 1, 'isn\'t available')
        self.assertEqual(models.Camper.objects.count(), 0)

    def test_an_event_without_lodging_refuses_a_lodging_request(self):
        other_tent = self.other_events_lodging()
        self.root.delete()
        self.assertRefused(self.register(other_tent), 0, 'isn\'t available')

    def test_lodging_that_does_not_exist_is_refused(self):
        missing = models.Lodging(id=999999, name='Missing')
        self.assertRefused(self.register(missing), 0, 'isn\'t available')

    def test_an_admin_may_still_overbook(self):
        self.assertEqual(self.register(self.cabin_a).status_code, 200)
        camper = models.Camper.objects.create(
            registration=models.Registration.objects.get(), attributes={'name': 'Extra'})
        self.client.force_authenticate(make_user(roles.REGISTRAR, 'reggie'))
        response = self.client.patch(
            f'/api/campers/{camper.id}/', {'lodging': self.cabin_a.id}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(models.Camper.objects.filter(lodging=self.cabin_a).count(), 2)


class SimultaneousRegistrationTests(TransactionTestCase):
    '''
    Two registrations for the last bed at the same moment: the second waits for
    the first, then finds the cabin full.
    '''

    def setUp(self):
        create_standard_test_event(self)
        build_lodging(self)

    def test_two_registrations_for_the_last_bed(self):
        # Each waits here, after taking the lock and counting, for the other: with
        # the lock the second is still queued, so the first gives up waiting and
        # goes on; without it both would count the same free bed.
        barrier = threading.Barrier(2, timeout=2)
        check = lodging.registration_lodging_problem

        def meet_then_check(tree, requested_ids):
            try:
                barrier.wait()
            except threading.BrokenBarrierError:
                pass
            return check(tree, requested_ids)

        results = {}

        def send(index):
            try:
                results[index] = register(APIClient(), self, self.cabin_a).status_code
            except Exception as error:
                results[index] = repr(error)
            finally:
                connection.close()

        threads = [threading.Thread(target=send, args=(i,)) for i in range(2)]
        with mock.patch.object(views, 'registration_lodging_problem', meet_then_check):
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(30)

        self.assertEqual(sorted(results.values()), [200, 400])
        self.assertEqual(models.Camper.objects.filter(lodging=self.cabin_a).count(), 1)
