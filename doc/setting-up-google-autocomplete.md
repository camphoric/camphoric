# Setting up your google API key for address autocomplete

1. Follow these instructions to create a project and get an api key:
   https://developers.google.com/maps/documentation/javascript/get-api-key
2. Go to your project dashboard and click on "Enable APIs and Services"
   ![](images/google_activate_api.png)
3. Activate the Places API (New) for your new key
4. Create the following file if it doesn't exist (`client_v2/.env.example` is a template):
   `<project_root>/client_v2/.env`
5. Add the following line to that file:
   `VITE_GOOGLE_MAPS_API_KEY=<your api key here>`
