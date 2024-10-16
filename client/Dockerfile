FROM node:22-bookworm

# Now install the CRA
ENV PATH="/app/node_modules/.bin:${PATH}"
WORKDIR /app
RUN apt -y update && apt -y upgrade
RUN apt-get install -y --no-install-recommends python3
RUN apt-get install -y --no-install-recommends python3-pip
RUN apt-get install -y --no-install-recommends make
RUN apt-get install -y --no-install-recommends gcc
RUN apt-get install -y --no-install-recommends g++

COPY . .
RUN ls -la
RUN npm ci
RUN mkdir -p node_modules/.cache && chmod -R 777 node_modules/.cache
RUN npm run postinstall
# RUN sh -c "npm run postinstall"
# RUN sh -c "cp node_modules/handlebars/dist/handlebars.js public/"
# RUN cp node_modules/jsoneditor/dist/jsoneditor.min.js public/
RUN ls -la public
