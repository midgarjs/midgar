In Dev don't use this

## Midgar

Midgar is a plugin manager for [Express](http://expressjs.com/)

## Installation

```sh
$ npm install -g @midgar/midgar
```

## Quick start

The quickest way to get started with Midgar is to utilize the cli to generate an application:

```bash
$ midgar init /my-project/
```

## Install dependencies

```bash
$ cd /my-project/
$ npm install
```

Now you can start the app but basically Midgar add just [Helmet](https://helmetjs.github.io/) and [Body-parser](https://github.com/expressjs/body-parser) middleware to express. You have to install Midgar plugin or create your.

## Start app

```bash
$ npm run dev
```

## Official plugins

| Name | Description |
|---------|-------------|
| [services](https://www.npmjs.com/package/@midgar/services) | Service loader with dependency injection |
| [route-loader](https://www.npmjs.com/package/@midgar/route-loader) | A route loader  |
| [db](https://www.npmjs.com/package/@midgar/db) | Sequelize for Midgar with model loader and db migration |
| [cache](https://www.npmjs.com/package/@midgar/cache) | A cache service with [node-cache-manager](https://www.npmjs.com/package/cache-manager) |
| [session](https://www.npmjs.com/package/@midgar/session) | Add sessions |