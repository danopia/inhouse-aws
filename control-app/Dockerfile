# Build image: https://github.com/disney/meteor-base
# Example: https://github.com/disney/meteor-base/blob/main/example/default.dockerfile

# The tag here should match the Meteor version of your app, per .meteor/release
FROM geoffreybooth/meteor-base:3.3.2 AS build
WORKDIR /opt/src

COPY ./package*.json ./
RUN meteor npm ci

# Copy piecemeal to help with caching
COPY .meteor ./.meteor
COPY client ./client
COPY imports ./imports
COPY server ./server
COPY tests ./tests
COPY tsconfig.json ./tsconfig.json
ARG METEOR_GIT_COMMIT_HASH
RUN meteor build --directory /opt/bundle --server-only --platforms web.browser

RUN rm -r /docker/node_modules /docker/*.json
RUN echo "true" > /docker/connect-to-mongo.sh

# Use the specific version of Node expected by your Meteor release, `meteor node --version`
FROM node:22.18.0-slim

ENV NODE_ENV production
ENV APP_BUNDLE_FOLDER /opt/bundle
ENV SCRIPTS_FOLDER /docker
WORKDIR /opt/bundle/bundle

COPY --from=build $SCRIPTS_FOLDER $SCRIPTS_FOLDER/

COPY --from=build $APP_BUNDLE_FOLDER/bundle/programs/server/package*.json ./programs/server/
COPY --from=build $APP_BUNDLE_FOLDER/bundle/programs/server/npm-rebuild*.js ./programs/server/
RUN cd programs/server && npm install --omit=dev

COPY --from=build $APP_BUNDLE_FOLDER/bundle ./

ENTRYPOINT ["/docker/entrypoint.sh"]
CMD ["node", "main.js"]
