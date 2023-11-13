FROM node:lts-alpine AS base

# Add a work directory
WORKDIR /app
# Cache and Install dependencies
COPY package.json package.json
COPY yarn.lock yarn.lock

RUN yarn global add ts-node typescript

FROM base as test
RUN yarn install --pure-lock-file
# Copy app files
COPY . .
CMD ["yarn", "test"]

FROM base as prod
RUN yarn install --pure-lock-file --production

COPY . .

RUN yarn add -D @types/node
# Build the app
RUN yarn build
RUN yarn tsc

CMD ["yarn", "start"]
