// Every report renders on the server from Camphoric's variables (DR-41).
export default [
  {
    title: 'Payments',
    output: 'md',
    variables_source: 'server',
    template: `
| Name | Total | Payments | Balance |
| ---- | ----- | -------- | ------- |
{% for r in registrations | sort(attribute="balance") | reverse -%}
| [{{ r.campers[0].attributes.first_name }} {{ r.campers[0].attributes.last_name }}](mailto:{{ r.registrant_email }}) | \${{ r.total_owed }} | \${{ r.total_paid }} | <div style="color: {{ 'red' if r.balance > 0 else 'black' }}">\${{ r.balance }}</div> |
{% endfor %}
`,
  },
];
