export default [
  {
    title: 'Payments',
    template: `
| Name | Total | Payments | Balance |
| ---- | ----- | -------- | ------- |
{{#eachrsort registrations "total_balance"}}
| [{{campers.0.attributes.first_name}} {{campers.0.attributes.last_name}}](mailto:{{registrant_email}}) | \${{total_owed}} | \${{total_payments}} | <div style="color: {{#if (gt total_balance 0)}}red{{else}}black{{/if}}">\${{total_balance}}</div> |
{{/eachrsort}}
`,
  },

];
