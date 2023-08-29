export default [
  {
    title: 'All Campers',
    output: 'hbs',
    template: `
| Last Name | First Name | Age | Lodging | Chore |
| --------- | ---------- | --- | ------- | ----- |
{{#eachsort campers "attributes.last_name"}}
| {{this.attributes.last_name}} | {{this.attributes.first_name}} | {{this.attributes.age}} | {{#with (lookup ../lodgingLookup [lodging])~}}
  {{name}} | {{/with}} {{this.attributes.chore}} |
{{/eachsort}}

Total Campers: {{campers.length}}
`,
  },
  {
    title: 'Payments',
    output: 'hbs',
    template: `
| Name | Total | Payments | Balance |
| ---- | ----- | -------- | ------- |
{{#eachrsort registrations "total_balance"}}
| [{{campers.0.attributes.first_name}} {{campers.0.attributes.last_name}}](mailto:{{registrant_email}}) | \${{total_owed}} | \${{total_payments}} | <div style="color: {{#if (gt total_balance 0)}}red{{else}}black{{/if}}">\${{total_balance}}</div> |
{{/eachrsort}}
`,
  },

];
