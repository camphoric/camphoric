# Generated by Django 4.2.3 on 2024-06-05 05:17

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camphoric', '0049_report_output_report_variables_schema'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='camper',
            options={'ordering': ('sequence', 'id')},
        ),
        migrations.AddField(
            model_name='camper',
            name='sequence',
            field=models.IntegerField(default=0, help_text='order of the campers'),
        ),
        migrations.AlterField(
            model_name='report',
            name='output',
            field=models.CharField(choices=[('html', 'Jinja to HTML'), ('md', 'Jinja to Markdown'), ('csv', 'Jinja to CSV'), ('hbs', 'Handlebars to Markdown'), ('txt', 'Jinja to Plain Text')], default='csv', max_length=4),
        ),
    ]
