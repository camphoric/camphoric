'''
/api-token-auth/ and DRF's `Token` are retired for personal access tokens
(camphoric.api_tokens, SPEC DR-157): `rest_framework.authtoken` is no longer
installed, so its table, and with it every token it issued, goes here, and so
do its migration records, so installing it again would make the table anew.
Going back drops nothing more: the old tokens can't be brought back.
'''

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0095_api_token'),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                'DROP TABLE IF EXISTS authtoken_token',
                "DELETE FROM django_migrations WHERE app = 'authtoken'",
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
