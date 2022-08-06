FROM node:16-alpine

# Now install the CRA
ENV PATH="/app/node_modules/.bin:${PATH}"
WORKDIR /app
RUN apk add --no-cache --virtual build-deps python3 py3-pip make g++

COPY . .
RUN ls -la
RUN npm ci
RUN mkdir -p node_modules/.cache && chmod -R 777 node_modules/.cache
RUN npm run postinstall
# RUN sh -c "npm run postinstall"
# RUN sh -c "cp node_modules/handlebars/dist/handlebars.js public/"
# RUN cp node_modules/jsoneditor/dist/jsoneditor.min.js public/
RUN ls -la public
