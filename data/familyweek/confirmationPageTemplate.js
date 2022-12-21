export default `
# Thank you for registering!

You will receive a confirmation email that your registration has been received.
If you cannot find your confirmation email, please check your spam folder before emailing the registrar.

To complete your registration process, you need to mail a check for the amount of
{{#pricing_results.pay_all}}
  **\${{pricing_results.total}}**
{{/pricing_results.pay_all}}
{{#pricing_results.pay_deposit}}
  **\${{pricing_results.deposit}}**
{{/pricing_results.pay_deposit}}
made out to "BACDS" to the following address:

Katie Riemer   
Family Week Registrar   
1602 Addison St.   
Berkeley, CA 94703

Please include a copy of your Registration Confirmation email and for each person, write what name they want on their name tag and their pronouns.

{{#pricing_results.pay_deposit}}
You have elected to only pay a deposit of \${{pricing_results.deposit}} to hold your place at camp.
{{/pricing_results.pay_deposit}}

Your registration is complete when we receive your payment. All payments must be received by May 1st. If you cancel before then, your payment will be refunded, less a $25 per camper administration fee. If you cancel between May 1st and June 15th, 50% of your payment will be retained. Sorry, there will be no refunds for cancellations after June 15th. All cancellations must be made in writing or by email and take effect upon the day they're sent, but are final only when you receive acknowledgement from us. Registrations are not transferable. If you have to cancel due to COVID, we will offer you a full refund.

[Back to Home](https://www.bacds.org/familyweek/)
`;
