export default [
  {
    title: 'All Campers',
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
    template: `
| Email | Total | Payments | Balance |
| ----- | ----- | -------- | ------- |
{{#eachrsort registrations "total_balance"}}
| {{registrant_email}} | \${{total_owed}} | \${{total_payments}} | <div style="color: {{#if (lt total_balance 0)}}red{{else}}black{{/if}}">\${{total_balance}}</div> |
{{/eachrsort}}
`,
  },

];
