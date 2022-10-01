const helpText = `
# Camphoric Template Help

Camphoric templates come in two forms:

- Email Templates
- Report Templates

## Camphoric Email Templates

If a template specifically says that it's used for email, then it is an email
template. Email templates are a combination of Github Flavored Markdown and
Mustache templates.  

See the following for documentation:

- [Github Flavored Markdown Documentation](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
- [Mustache Templating Language Documentation](https://mustache.github.io/mustache.5.html)

## Camphoric Report Templates

All other templates are report templates.  These are a combination of Github
Flavored Markdown and Handlebars templates.  Handlebars templates are like
Mustache templates with additional functionality like "if" statements, lookups
and more.

See the following for documentation:

- [Github Flavored Markdown Documentation](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
- [Handlebars Templating Language Documentation](https://handlebarsjs.com/guide/)

## Variables Used for This Template

See the tab labeled "Variables" to see the variables passed to this template.
`;

export default helpText;
