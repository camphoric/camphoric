# Generated by Django 3.2.15 on 2022-09-26 02:25

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0038_auto_20220924_0907'),
    ]

    operations = [
        migrations.AddField(
            model_name='camper',
            name='lodging_comments',
            field=models.TextField(blank=True, default='', help_text='comments from the camper re: lodging'),
        ),
    ]
