'''Multi-event reports: included events, linking people, suggestions and stats (SPEC §8.12).'''

import datetime

from auditlog.models import LogEntry
from rest_framework.test import APITestCase

from camphoric import models, roles
from camphoric.multi_event import matching, people, stats
from tests.factories import make_user

AGES = ['65 years old or older', '26-49 years old', '12-17 years old', '5-11 years old']


def make_event(organization, name, year, *, series='', included=True):
    event = models.Event.objects.create(
        organization=organization, name=name, start=datetime.date(year, 7, 1),
        end=datetime.date(year, 7, 8),
        registration_start=datetime.datetime(year, 2, 1, tzinfo=datetime.UTC))
    if included is not None:
        models.MultiEventInclusion.objects.create(event=event, included=included, series=series)
    return event


def make_camper(event, first, last, *, email=None, registrant_email='', age=None):
    registration = models.Registration.objects.create(
        event=event, registrant_email=registrant_email, attributes={})
    attributes = {'first_name': first, 'last_name': last}
    if email:
        attributes['email'] = email
    if age:
        attributes['age'] = age
    return models.Camper.objects.create(registration=registration, attributes=attributes)


def base(organization_id):
    return f'/api/organizations/{organization_id}/multi-event'


class MultiEventTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.organization = models.Organization.objects.create(name='Lark')
        cls.other_organization = models.Organization.objects.create(name='Other')
        cls.camp23 = make_event(cls.organization, 'Camp 2023', 2023, series='Camp')
        cls.camp24 = make_event(cls.organization, 'Camp 2024', 2024, series='Camp')
        cls.campout24 = make_event(cls.organization, 'Campout 2024', 2024, series='Campout')
        cls.camp25 = make_event(cls.organization, 'Camp 2025', 2025, series='Camp')
        cls.left_out = make_event(cls.organization, 'Camp 2022', 2022, included=None)
        cls.elsewhere = make_event(cls.other_organization, 'Other 2024', 2024)
        cls.admin = make_user(roles.ADMIN)
        cls.registrar = make_user(roles.REGISTRAR)
        cls.reporter = make_user(roles.REPORTER)

    def setUp(self):
        self.client.force_authenticate(self.registrar)

    def url(self, path):
        return f'{base(self.organization.id)}/{path}'


class IncludedEventsTests(MultiEventTestCase):
    def test_lists_the_organizations_events_in_chooser_order(self):
        response = self.client.get(self.url('events'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['name'] for row in response.data],
                         ['Camp 2025', 'Camp 2024', 'Campout 2024', 'Camp 2023', 'Camp 2022'])
        row = response.data[-1]
        self.assertEqual((row['included'], row['series']), (False, ''))
        self.assertEqual(response.data[0]['series'], 'Camp')

    def test_includes_an_event_and_sets_its_series(self):
        response = self.client.patch(
            self.url(f'events/{self.left_out.id}'),
            {'included': True, 'series': '  Lark   Camp '}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual((response.data['included'], response.data['series']),
                         (True, 'Lark Camp'))
        inclusion = models.MultiEventInclusion.objects.get(event=self.left_out)
        self.assertTrue(inclusion.included)

    def test_a_save_writes_only_what_it_changes(self):
        # A request that read the row before another saved the series doesn't write it back.
        stale = models.Event.objects.select_related('multi_event').get(pk=self.camp23.pk)
        models.MultiEventInclusion.objects.filter(event=self.camp23).update(series='Lark')
        people.set_inclusion(stale, included=False)
        inclusion = models.MultiEventInclusion.objects.get(event=self.camp23)
        self.assertEqual((inclusion.included, inclusion.series), (False, 'Lark'))

    def test_leaving_an_event_out_keeps_its_series(self):
        self.client.patch(self.url(f'events/{self.camp23.id}'), {'included': False},
                          format='json')
        inclusion = models.MultiEventInclusion.objects.get(event=self.camp23)
        self.assertEqual((inclusion.included, inclusion.series), (False, 'Camp'))

    def test_refuses_another_organizations_event(self):
        response = self.client.patch(
            self.url(f'events/{self.elsewhere.id}'), {'included': True}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_reporters_read_but_dont_change(self):
        self.client.force_authenticate(self.reporter)
        self.assertEqual(self.client.get(self.url('events')).status_code, 200)
        response = self.client.patch(
            self.url(f'events/{self.camp23.id}'), {'included': False}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_needs_a_role(self):
        self.client.force_authenticate(make_user(None))
        self.assertEqual(self.client.get(self.url('events')).status_code, 403)

    def test_changes_are_audited(self):
        self.client.patch(self.url(f'events/{self.camp23.id}'), {'series': 'Lark'},
                          format='json')
        entry = LogEntry.objects.get_for_object(
            models.MultiEventInclusion.objects.get(event=self.camp23)).first()
        self.assertEqual(entry.actor, self.registrar)


class CamperRecordsTests(MultiEventTestCase):
    def test_lists_the_live_campers_of_included_events(self):
        kept = make_camper(self.camp23, 'Ann', 'Lee', email='ann@example.com',
                           registrant_email='lees@example.com', age='26-49 years old')
        make_camper(self.left_out, 'Ann', 'Lee')
        make_camper(self.elsewhere, 'Ann', 'Lee')
        deleted = make_camper(self.camp24, 'Bo', 'Lee')
        deleted.soft_delete()
        gone = make_camper(self.camp25, 'Cy', 'Lee')
        gone.registration.soft_delete()

        response = self.client.get(self.url('campers'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [{
            'camper': kept.id, 'event': self.camp23.id, 'registration': kept.registration_id,
            'person': None, 'name': 'Ann Lee', 'first_name': 'Ann', 'last_name': 'Lee',
            'age': '26-49 years old', 'email': 'ann@example.com',
            'registrant_email': 'lees@example.com',
        }])


class LinkingTests(MultiEventTestCase):
    def setUp(self):
        super().setUp()
        self.ann23 = make_camper(self.camp23, 'Ann', 'Lee')
        self.ann24 = make_camper(self.camp24, 'Ann', 'Lee')
        self.ann25 = make_camper(self.camp25, 'Annie', 'Lee')

    def link(self, *campers):
        return self.client.post(self.url('link'), {'campers': [c.id for c in campers]},
                                format='json')

    def test_links_records_as_one_person(self):
        response = self.link(self.ann23, self.ann24)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['campers'], [self.ann23.id, self.ann24.id])
        person = models.Person.objects.get(pk=response.data['person'])
        self.assertEqual(person.organization, self.organization)

    def test_linking_adds_to_and_merges_people(self):
        first = self.link(self.ann23, self.ann24).data['person']
        added = self.link(self.ann24, self.ann25)
        self.assertEqual(added.data['person'], first)
        self.assertEqual(added.data['campers'], [self.ann23.id, self.ann24.id, self.ann25.id])

        bo23 = make_camper(self.camp23, 'Bo', 'Ng')
        bo_out = make_camper(self.campout24, 'Bo', 'Ng')
        second = self.link(bo23, bo_out).data['person']
        refused = self.link(bo_out, self.ann25)
        self.assertEqual(refused.status_code, 400)  # both people were at Camp 2023
        self.assertTrue(models.Person.objects.filter(pk=second).exists())

    def test_merging_two_people_keeps_one(self):
        first = self.link(self.ann23, self.ann24).data['person']
        out = make_camper(self.campout24, 'Ann', 'Lee')
        second = self.link(out, self.ann25).data['person']
        merged = self.link(self.ann24, self.ann25)
        self.assertEqual(merged.status_code, 200, merged.data)
        self.assertEqual(merged.data['person'], min(first, second))
        self.assertEqual(len(merged.data['campers']), 4)
        self.assertFalse(models.Person.objects.filter(pk=max(first, second)).exists())

    def test_refuses_two_records_of_one_event(self):
        twin = make_camper(self.camp23, 'Ann', 'Lee')
        response = self.link(self.ann23, twin)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Camp 2023', str(response.data['campers']))
        self.assertFalse(models.Person.objects.exists())

    def test_refuses_records_outside_the_included_events(self):
        for camper in (make_camper(self.left_out, 'Ann', 'Lee'),
                       make_camper(self.elsewhere, 'Ann', 'Lee')):
            response = self.link(self.ann23, camper)
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.link(self.ann23).status_code, 400)

    def test_reporters_cant_link(self):
        self.client.force_authenticate(self.reporter)
        self.assertEqual(self.link(self.ann23, self.ann24).status_code, 403)

    def test_linking_is_audited_without_a_new_version(self):
        version = self.ann23.version
        self.link(self.ann23, self.ann24)
        self.ann23.refresh_from_db()
        self.assertEqual(self.ann23.version, version)
        entry = LogEntry.objects.get_for_object(self.ann23).order_by('-timestamp').first()
        self.assertIn('person', entry.changes_dict)
        self.assertEqual(entry.actor, self.registrar)

    def test_a_camper_edit_cant_set_the_person(self):
        person = models.Person.objects.create(organization=self.organization)
        response = self.client.patch(f'/api/campers/{self.ann23.id}/', {'person': person.id},
                                     format='json')
        self.assertEqual(response.status_code, 200)
        self.ann23.refresh_from_db()
        self.assertIsNone(self.ann23.person)

    def unlink(self, *campers):
        return self.client.post(self.url('unlink'), {'campers': [c.id for c in campers]},
                                format='json')

    def test_unlinking_dismisses_the_match_and_dissolves_a_lone_person(self):
        person = self.link(self.ann23, self.ann24, self.ann25).data['person']
        response = self.unlink(self.ann25)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'person': None})
        self.ann25.refresh_from_db()
        self.assertIsNone(self.ann25.person)
        self.assertTrue(models.Person.objects.filter(pk=person).exists())
        self.assertEqual(matching.suggestions(self.organization), [])

        self.unlink(self.ann24)
        self.assertFalse(models.Person.objects.exists())
        self.ann23.refresh_from_db()
        self.assertIsNone(self.ann23.person)

    def test_undoing_a_merge_keeps_the_records_split_off_together(self):
        cy24 = make_camper(self.campout24, 'Cy', 'Park')
        cy25 = make_camper(self.camp25, 'Cy', 'Park')
        self.link(self.ann23, self.ann24)
        self.link(cy24, cy25)
        merged = self.link(self.ann24, cy24).data['person']  # by mistake

        response = self.unlink(cy24, cy25)
        self.assertEqual(response.status_code, 200, response.data)
        split = response.data['person']
        self.assertNotEqual(split, merged)
        cy24.refresh_from_db()
        cy25.refresh_from_db()
        self.assertEqual((cy24.person_id, cy25.person_id), (split, split))
        self.assertFalse(models.PersonMatchDismissal.objects.filter(
            camper_a=cy24, camper_b=cy25).exists())
        self.assertTrue(models.PersonMatchDismissal.objects.filter(
            camper_a=self.ann23, camper_b=cy24).exists())

    def test_unlinking_refuses_what_it_cant_do(self):
        bo23 = make_camper(self.camp23, 'Bo', 'Ng')
        bo24 = make_camper(self.camp24, 'Bo', 'Ng')
        self.link(self.ann23, self.ann24)
        self.link(bo23, bo24)
        self.assertEqual(self.unlink(self.ann25).status_code, 400)  # linked to no one
        self.assertEqual(self.unlink(self.ann23, bo23).status_code, 400)  # two people
        self.assertEqual(self.unlink(self.ann23, self.ann24).status_code, 400)  # all of them

    def test_a_link_counts_only_in_its_organization(self):
        person = self.link(self.ann23, self.ann24).data['person']
        moved = make_camper(self.elsewhere, 'Ann', 'Lee')
        moved.person_id = person
        moved.save_without_recalc()  # as if moved here from an event of the first
        stranger = make_camper(
            make_event(self.other_organization, 'Other 2025', 2025), 'Ann', 'Lee')

        other = base(self.other_organization.id)
        rows = self.client.get(f'{other}/campers').data
        self.assertEqual([r['person'] for r in rows], [None, None])

        response = self.client.post(f'{other}/link', {'campers': [moved.id, stranger.id]},
                                    format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotEqual(response.data['person'], person)
        self.assertEqual(response.data['campers'], [moved.id, stranger.id])
        self.assertEqual(models.Person.objects.get(pk=response.data['person']).organization,
                         self.other_organization)
        self.ann23.refresh_from_db()
        self.assertEqual(self.ann23.person_id, person)

    def test_a_person_goes_with_their_records(self):
        self.link(self.ann23, self.ann24)
        self.ann24.registration.delete()
        self.ann23.refresh_from_db()
        self.assertIsNone(self.ann23.person)
        self.assertFalse(models.Person.objects.exists())

    def test_a_soft_deleted_record_keeps_its_link(self):
        person = self.link(self.ann23, self.ann24).data['person']
        self.ann24.soft_delete()
        self.ann24.refresh_from_db()
        self.assertEqual(self.ann24.person_id, person)
        self.assertEqual([r.camper for r in people.records(self.organization)
                          if r.person == person], [self.ann23.id])

    def test_a_restored_record_cant_give_a_person_two_in_one_event(self):
        person = self.link(self.ann23, self.ann24).data['person']
        self.ann24.soft_delete()
        ann24_again = make_camper(self.camp24, 'Ann', 'Lee')
        self.assertEqual(self.link(self.ann23, ann24_again).data['person'], person)
        self.ann24.refresh_from_db()
        self.assertIsNone(self.ann24.person)  # the deleted one is taken out
        self.ann24.soft_undelete()
        self.assertEqual(
            sorted(c.id for c in models.Camper.objects.filter(person_id=person)),
            [self.ann23.id, ann24_again.id])

    def test_a_record_whose_partner_is_deleted_can_be_unlinked(self):
        self.link(self.ann23, self.ann24)
        self.ann24.soft_delete()
        response = self.unlink(self.ann23)
        self.assertEqual(response.status_code, 200, response.data)
        self.ann23.refresh_from_db()
        self.assertIsNone(self.ann23.person)
        self.assertFalse(models.Person.objects.exists())


class SuggestionTests(MultiEventTestCase):
    def suggest(self):
        response = self.client.get(self.url('suggestions'))
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_same_name_across_years_is_one_suggestion(self):
        a = make_camper(self.camp23, 'Ann', 'Lee')
        b = make_camper(self.camp24, 'ann', 'LEE')
        c = make_camper(self.camp25, 'Ánn', 'Lee')
        make_camper(self.camp24, 'Bo', 'Ng')
        [suggestion] = self.suggest()
        self.assertEqual(suggestion['campers'], [a.id, b.id, c.id])
        self.assertEqual(suggestion['level'], 'likely')
        self.assertEqual(suggestion['reasons'], ['same_name'])
        self.assertEqual(suggestion['people'], [])

    def test_a_shared_email_makes_it_strong(self):
        make_camper(self.camp23, 'Ann', 'Lee', registrant_email='lees@example.com')
        make_camper(self.camp24, 'Ann', 'Lee', registrant_email='LEES@example.com')
        [suggestion] = self.suggest()
        self.assertEqual(suggestion['level'], 'strong')

    def test_changed_last_name_with_own_email(self):
        make_camper(self.camp23, 'Ann', 'Lee', email='ann@example.com')
        make_camper(self.camp24, 'Ann', 'Park', email='ann@example.com')
        [suggestion] = self.suggest()
        self.assertEqual(suggestion['level'], 'likely')

    def test_nicknames_and_typos_are_possible(self):
        make_camper(self.camp23, 'William', 'Hart')
        make_camper(self.camp24, 'Bill', 'Hart')
        make_camper(self.camp23, 'Margaret', 'Olsen')
        make_camper(self.camp24, 'Margaret', 'Olson')
        levels = {s['name']: (s['level'], s['reasons']) for s in self.suggest()}
        self.assertEqual(levels, {
            'Bill Hart': ('possible', ['nickname', 'same_last_name']),
            'Margaret Olson': ('possible', ['same_first_name', 'similar_last_name']),
        })

    def test_family_members_arent_suggested(self):
        make_camper(self.camp23, 'Ann', 'Lee', registrant_email='lees@example.com')
        make_camper(self.camp24, 'Bo', 'Lee', registrant_email='lees@example.com')
        self.assertEqual(self.suggest(), [])

    def test_same_event_and_falling_age_arent_suggested(self):
        make_camper(self.camp23, 'Ann', 'Lee')
        make_camper(self.camp23, 'Ann', 'Lee')
        make_camper(self.camp24, 'Jo', 'Day', age='26-49 years old')
        make_camper(self.camp25, 'Jo', 'Day', age='5-11 years old')
        self.assertEqual(self.suggest(), [])

    def test_a_suggestion_never_joins_records_whose_ages_fall(self):
        make_camper(self.camp23, 'Jo', 'Day', age='12-17 years old')
        make_camper(self.camp24, 'Jo', 'Day')
        make_camper(self.camp25, 'Jo', 'Day', age='5-11 years old')
        [suggestion] = self.suggest()
        self.assertEqual(len(suggestion['campers']), 2)

    def test_a_linked_person_is_suggested_with_a_new_record(self):
        a = make_camper(self.camp23, 'Ann', 'Lee')
        b = make_camper(self.camp24, 'Ann', 'Lee')
        person = people.link(self.organization, [a.id, b.id])
        c = make_camper(self.camp25, 'Ann', 'Lee')
        [suggestion] = self.suggest()
        self.assertEqual(suggestion['campers'], [a.id, b.id, c.id])
        self.assertEqual(suggestion['people'], [person.id])

    def test_a_suggestion_keeps_one_record_per_event(self):
        make_camper(self.camp23, 'Ann', 'Lee')
        make_camper(self.camp24, 'Ann', 'Lee')
        make_camper(self.camp24, 'Ann', 'Lee')
        for suggestion in self.suggest():
            events = [models.Camper.objects.get(pk=c).registration.event_id
                      for c in suggestion['campers']]
            self.assertEqual(len(events), len(set(events)))

    def test_dismissed_matches_arent_suggested_again(self):
        a = make_camper(self.camp23, 'Ann', 'Lee')
        b = make_camper(self.camp24, 'Ann', 'Lee')
        response = self.client.post(self.url('dismiss'), {'campers': [b.id, a.id]},
                                    format='json')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.suggest(), [])
        pair = models.PersonMatchDismissal.objects.get()
        self.assertEqual((pair.camper_a, pair.camper_b), (a, b))

    def test_reporters_see_suggestions_but_cant_dismiss(self):
        a = make_camper(self.camp23, 'Ann', 'Lee')
        b = make_camper(self.camp24, 'Ann', 'Lee')
        self.client.force_authenticate(self.reporter)
        self.assertEqual(len(self.suggest()), 1)
        response = self.client.post(self.url('dismiss'), {'campers': [a.id, b.id]},
                                    format='json')
        self.assertEqual(response.status_code, 403)

    def test_name_comparisons(self):
        self.assertTrue(matching.one_letter_apart('olsen', 'olson'))
        self.assertTrue(matching.one_letter_apart('jonh', 'john'))
        self.assertTrue(matching.one_letter_apart('sara', 'sarah'))
        self.assertFalse(matching.one_letter_apart('ann', 'anne'))  # too short to tell
        self.assertFalse(matching.one_letter_apart('peter', 'petra'))
        self.assertTrue(matching.nicknames('liz', 'elizabeth'))
        self.assertFalse(matching.nicknames('liz', 'liz'))
        self.assertEqual(matching.age_number('50-64 years old'), 50)
        self.assertIsNone(matching.age_number('adult'))
        self.assertEqual(matching.normalize(" Zoë  O'Brien-Smith "), 'zoe obrien smith')


class StatsTests(MultiEventTestCase):
    def test_attendance_and_retention(self):
        ann = [make_camper(e, 'Ann', 'Lee') for e in (self.camp23, self.camp24, self.camp25)]
        people.link(self.organization, [c.id for c in ann])
        bo = [make_camper(e, 'Bo', 'Ng') for e in (self.camp23, self.campout24)]
        people.link(self.organization, [c.id for c in bo])
        make_camper(self.camp24, 'Cy', 'Day')
        make_camper(self.camp25, 'Cy', 'Day')  # not linked: counts as someone new

        response = self.client.get(self.url('stats'))
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data['series'], ['Camp', 'Campout'])
        rows = {row['name']: row for row in data['events']}
        self.assertEqual([row['name'] for row in data['events']],
                         ['Camp 2023', 'Camp 2024', 'Campout 2024', 'Camp 2025'])
        self.assertEqual(
            {k: rows['Camp 2024'][k] for k in ('campers', 'registrations', 'people', 'new',
                                               'returning')},
            {'campers': 2, 'registrations': 2, 'people': 2, 'new': 1, 'returning': 1})
        self.assertEqual(rows['Camp 2024']['previous'],
                         {'event': self.camp23.id, 'name': 'Camp 2023', 'people': 2,
                          'returned': 1})
        self.assertIsNone(rows['Campout 2024']['previous'])
        self.assertEqual(rows['Campout 2024']['returning'], 1)
        self.assertEqual(rows['Camp 2025']['previous']['returned'], 1)
        self.assertEqual(rows['Camp 2025']['year'], 2025)

        first = data['people'][0]
        self.assertEqual((first['name'], first['attended'], first['longest_run']),
                         ('Ann Lee', 3, 3))
        self.assertEqual(first['events'], [self.camp23.id, self.camp24.id, self.camp25.id])
        self.assertEqual(len(data['people']), 4)

    def test_one_series(self):
        make_camper(self.campout24, 'Bo', 'Ng')
        make_camper(self.camp23, 'Ann', 'Lee')
        data = self.client.get(self.url('stats'), {'series': 'Campout'}).data
        self.assertEqual([row['name'] for row in data['events']], ['Campout 2024'])
        self.assertEqual([p['name'] for p in data['people']], ['Bo Ng'])
        self.assertEqual(data['events'][0]['new'], 1)

    def test_longest_run(self):
        self.assertEqual(stats.longest_run({2019, 2021, 2022, 2023, 2025}), 3)
        self.assertEqual(stats.longest_run(set()), 0)
