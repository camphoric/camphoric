'''
Multi-event reports (SPEC §8.12, DR-177–DR-180): an organization's data across
the events it includes, with camper records from different events linked as one
person so they can be followed from year to year.

- `people`: the included events, the camper records in them, and linking,
  unlinking and dismissing suggested matches.
- `matching`: the suggested matches.
- `stats`: attendance and retention across the included events.
- `views`: the API, under `organizations/<id>/multi-event/`.
'''
