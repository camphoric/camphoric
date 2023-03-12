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
    title: 'Registration Payments',
    template: `
| Name | Total | Payments | Balance |
| ---- | ----- | -------- | ------- |
{{#eachrsort registrations "total_balance"}}
| [{{campers.0.attributes.first_name}} {{campers.0.attributes.last_name}}](mailto:{{registrant_email}}) | \${{total_owed}} | \${{total_payments}} | <div style="color: {{#if (gt total_balance 0)}}red{{else}}black{{/if}}">\${{total_balance}}</div> |
{{/eachrsort}}
`,
  },
  {
    title: 'Camper Vaccinations',
    template: `
| Last Name | First Name | Age | Vaccination |
| --------- | ---------- | --- | ----- |
{{#eachrsort campers "attributes.vaccination_status"}}
| {{this.attributes.last_name}} | {{this.attributes.first_name}} | {{this.attributes.age}} | {{this.attributes.vaccination_status}} |
{{/eachrsort}}

Total Campers: {{campers.length}}
`,
  },
  {
    title: 'Camper Lodging (Simple)',
    template: `
| Last Name | First Name | Age | Lodging | Sharing | Sharing with |
| --------- | ---------- | --- | ------- | ----- | ----- |
{{#eachsort campers "lodging"}}
| {{this.attributes.last_name}} | {{this.attributes.first_name}} | {{this.attributes.age}} | {{#with (lookup ../lodgingLookup [lodging])~}}
  {{name}} | {{/with}} {{this.lodging_shared}} | {{lodging_shared_with}} |
{{/eachsort}}

Total Campers: {{campers.length}}
`,
  },
  {
    title: 'Campers by Reg Date',
    template: `
Total Campers: {{campers.length}}

| First Name | Last Name | Age | Lodging | Chore |
| --------- | ---------- | --- | ------- | ----- |
{{#eachrsort campers "created_at"}}
| {{this.attributes.first_name}} | {{this.attributes.last_name}} | {{this.attributes.age}} | {{#with (lookup ../lodgingLookup [lodging])~}}
  {{name}} | {{/with}} {{this.attributes.chore}} |
{{/eachrsort}}

Total Campers: {{campers.length}}
`,
  },
  {
    title: 'Camper Email List For Mailing',
    template: `
{{#each campers}}
{{this.attributes.first_name}} {{this.attributes.last_name}} &lt;{{this.attributes.email}}&gt;{{#unless @last}}, {{/unless}}
{{/each}}

Total Campers: {{campers.length}}
`,
  },
  {
    title: 'Donation Report',
    template: `
| Name | Email | Donation  |
| ----- | ----- | -------- |
{{#eachrsort registrations "campers.0.attributes.last_name"}}
{{#if server_pricing_results.donation}}
| [{{campers.0.attributes.first_name}} {{campers.0.attributes.last_name}}](mailto:{{registrant_email}}) |  {{registrant_email}} | \${{server_pricing_results.donation}}  |
{{/if}}
{{/eachrsort}}
`,
  },
];
