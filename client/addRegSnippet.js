/**
 * Add test campers easily
 *
 * This is a script that you can put in your chrome snippets.  Edit the camper
 * array at the top and those will be the values submitted with this
 * registration.
 *
 * Instructions:
 * 1. Go to the registration page
 * 2. paste this snippet under DevTools → Sources → Snippets
 * 3. Edit the testCampers data
 * 4. Run the snippet
 * 5. Do steps 3-4 until you've filled up with a lot of campers
 */

window.testCampers = [
  ['jamie', 'candice', 22 ,'O'],
  ['jane',  'candice', 42 ,'F'],
  ['bob',   'candice', 48 ,'M'], // last camper is the primary
];

window.submitTestData = async function(campers) {
  function getCsrfToken() {
    const match = document.cookie.match(/\bcsrftoken=([^;]+)/);

    return (match && match[1]) || '';
  }

  campers.forEach(c => window.createCamperData(...c));
  const testData = JSON.stringify(window.testDataToSubmit);

  console.log('starting submit', testData);
  const res = await fetch(`/api/events/2/register`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: testData,
  });
  const data = await res.json();
  console.log("response", res.status, data);
}

window.createCamperData = function(first, last, age = 18, gender = 'O') {
  const camper = {
    "meals": {
      "meal_plan": "F"
    },
    "accommodations": {
      "camp_preference": "Camp 1",
      "tenting_area_preference": {
        "first_choice": "A",
        "third_choice": "C",
        "fourth_choice": "C",
        "second_choice": "B"
      },
      "accommodation_preference": "Tent"
    },
    "address_different_than_payer": false,
    "camper_address": {
      "country": "United States"
    },
    "first_name": first,
    "last_name": `${last}-camper`,
    "gender": "M",
    "session": "F"
  };

  if (age < 18) {
    camper.age = age;
  }

  window.testDataToSubmit.formData.campers.unshift(camper);
  window.testDataToSubmit.pricingResults.campers.unshift({
    "tuition": 0,
    "meals": 0,
    "total": 0
  });

  window.testDataToSubmit.formData.payment.payer_first_name = first;
  window.testDataToSubmit.formData.payment.payer_last_name = `${last}-payer`;
}

window.testDataToSubmit = {
  "formData": {
    "payment": {
      "payment_type": "check",
      "payer_billing_address": {
        "country": "United States",
        "street_address": "1234 Easy St",
        "city": "Berkeley",
        "state_or_province": "ca",
        "zip_code": "94703"
      },
      "payment_full_or_deposit": "full",
      "payer_first_name": "Bob",
      "payer_last_name": "Marley Payer",
      "payer_number": "+17073373611"
    },
    "campers": [],
    "registrant_email": "bob@gmail.com"
  },
  "pricingResults": {
    "campers": [],
    "parking": 0,
    "shirts": 0,
    "donation": 0,
    "total": 0,
    "tuition": 0,
    "meals": 0
  }
};

window.submitTestData(window.testCampers);
