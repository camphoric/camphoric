import { year } from './dates.js'

export default `
# You're all set!

## See you at Lark Camp ${year}!

{{#compare paymentInfo.paymentType '===' 'Check'}}
Please make your check out for for **\${{paymentInfo.paymentData.total}}**
payable to "Lark Camp", and mail it to:

Lark Camp  
PO Box 1724  
Mendocino, CA 95460  
USA
{{/compare}}
{{#compare paymentInfo.paymentType '!==' 'Check'}}
Thanks for paying electronically, please check your email for your receipt. If there was any
problems with your payment, the registrar will be in touch.
{{/compare}}


Do you need approval for your vehicle or trailer, have questions about
carpooling, payments, meals, ordering t-shirts, or anything else? Email us at
[registration@larkcamp.org](mailto:registration@larkcamp.org) or call
[707-397-5275](tel:707-397-5275)

[Visit our website at www.larkcamp.org for more information!](https://www.larkcamp.org)
`;
