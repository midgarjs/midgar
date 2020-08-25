## En développement ne pas utiliser en production

[![Build Status](https://drone.midgar.io/api/badges/Midgar/midgar/status.svg)](https://drone.midgar.io/Midgar/midgar)
[![Coverage](https://sonar.midgar.io/api/project_badges/measure?project=midgar-midgar&metric=coverage)](https://sonar.midgar.io/dashboard?id=midgar-midgar)

# Midgar

## Qu'est ce que Midgar

Midgar est un framework nodejs modulaire.
Il se base sur un système de plugin pour permettre de réaliser rapidement des applications web complexes de manière claire et structuré.

## Démarrage

Le moyen le plus rapide de démarrer avec Midgar est d'utiliser le CLI pour générer la structure d'un projet.

```bash
$ npm install -g @midgar/midgar
$ midgar init ~/mon-projet/
$ cd ~/mon-projet/
$ npm i
```

En soit Midgar ne fait que charger des plugins, sans plugin, il ne fait donc rien de concret !
L'étape suivante est donc d'installer des plugins ou d'en créer un. L'installation des plugins se fait via npm ou yarn.
L'utilisation des scripts de npm permet l'activation automatique des plugins sur le projet.

Vous pouvez voir la structure du projet générer par la commande init [ici](https://github.com/midgarjs/midgar/tree/master/templates/project).

## Documentation

[documentation Api](https://midgarjs.github.io/midgar/).

## Plugins

| Nom                                            | Description                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [service](https://github.com/midgarjs/service) | Système de services avec injection de dépendances.                                                |
| [express](https://github.com/midgarjs/express) | Service [Express](https://expressjs.com/).                                                        |
| [route](https://github.com/midgarjs/route)     | Système de router, controller et validateur pour la gestion des routes d'express.                 |
| [migrate](https://github.com/midgarjs/migrate) | Service de migration                                                                              |
| [mongo](https://github.com/midgarjs/mongo)     | Service [Mongoose](https://mongoosejs.com/) avec chargement des models et gestion des migrations. |
| [redis](https://github.com/midgarjs/redis)     | Gestionnaire de client Redis basé sur [node-redis](https://github.com/NodeRedis/node-redis).      |

## Créer un plugin

Le CLI vous permet de générer la structure d'un plugin et de l'activer:

```bash
$ cd ~/mon-projet/
$ midgar new @ns/blog
$ npm update
```

### Fichier plugin

Voici le fichier plugin généré par la command:

```js
import { Plugin } from '@midgar/midgar'

/**
 * BlogPlugin class
 */
export default class BlogPlugin extends Plugin {
  /**
   * Init plugin
   */
  init() {}
}
```

La méthode init est appelée automatiquement au chargement des plugins. elle est asynchrone.

### Package npm

Un plugin est en premier lieu un package npm et doit etre forcement accompagné d'un fichier **package.json**. Le main du **package.json** doit pointer sur le fichier plugin.

Pour fonctionner il doit aussi etre déclarré dans le fichier **plugins.json** contenu dans le dossier de configuration du projet.

### Configuration du plugin

Le plugin peut etre configuer en exportant la variable config depuis le fichier plugin.

```js
import { Plugin } from '@midgar/midgar'

/**
 * BlogPlugin class
 */
export default class BlogPlugin extends Plugin {
  /**
   * Init plugin
   */
  init() {}
}

export const config = {
  moduleTypes: {
    'midgar-mongo-model': 'models'
  }
}
```

### Modules

Le système de plugin comprend un importer de modules.
Vous pouvez déclarrer un type de module a importer dans la methode init de votre plugin:

```js
import { Plugin } from '@midgar/midgar'

export default class TestPlugin extends Plugin {
  init() {
    this.pm.addModuleType('mon-type', 'mondossier', '**/*.js')
  }
}
```

**_mon-type_** corréspond à l'identifiant du type de module.

**_modossier_** corréspond au chemin par défaut du dossier contenant ce type de modules.

**\_**/\*.js\_\*\* corréspond au pattern glob pour le chargement des modules.

@see: https://midgarjs.github.io/midgar/PluginManager.html#addModuleType__anchor

Pour importer tous les modules:

```js
import { Plugin } from '@midgar/midgar'

export default class TestPlugin extends Plugin {
  init () {
    this.mid.on('@midgar/midgar:afterInitPlugins', async () => {
      const files = await this.mid.pm.importModules('mon-type', '**/*.js')
      ...
    })
  }
}
```

@see: https://midgarjs.github.io/midgar/PluginManager.html#importModules__anchor

La méthode **importModules** importe tous les modules **mon-type** pour tous les plugins.

Le chemin du dossier **mon-type** est par défaut **./mondossier/** relativement par rapport au fichier plugin.

La méthode **importModules** renvoit un tableau d'object:

```js
[
  {
    name: 'plugin-test:fichier',
    path: '~/mon-projet/src/plugins/test-plugin/mondossier/fichier.js',
    export: ... // La valeur export default du module
    plugin: 'test-plugin',
    relativePath: 'fichier.js'
  },
  ...
}
```

Pour importer un seul modules:

```js
import { Plugin } from '@midgar/midgar'

export default class TestPlugin extends Plugin {
  init () {
    this.mid.on('@midgar/midgar:afterInitPlugins', async () => {
      const files = await this.mid.pm.importModule('plugin-test:fichier', 'mon-type')
      ...
    })
  }
}
```

Le chemin du dossier **mon-type** peut etre configuré pour chaque plugin dans le fichier **plugin-config.js**:

```js
export default {
  moduleTypes: {
    'mon-type': 'mon/nouveau/dossier'
  }
}
```

ou

```js
export default {
  moduleTypes: {
    'mon-type': {
      path: 'mon/nouveau/dossier',
      glob: '**/*.js',
      ignore: '**/*.schema.js'
  }
}
```

### Réecriture

Si un plugin ne fait pas axactement ce dont vous avez besoin, ou bien si vous voulez enrichir les fonctionnalitées d'un plugin, vous pouvez utiliser le système de réecture.
Les plugins ainsi que les modules importé sont réecrivable.

#### Plugin

Pour réecrire un plugin, ajouter ceci dans la configuration du plugin.

```js
export const config = {
    rewrite:{
      plugin: '@midgar/mongo'
    }
  }
}
```

Lors du chargement des plugins, ce plugin sera chargé à la place du plugin **@midgar/mongo**.

Le plugin devrait ressembler à ceci:

```js
import ServicePlugin from '@midgar/service'

export default class RewritePlugin extends ServicePlugin {
  async init () {
    await super.init()
    ....
  }
}

```

### Module

Pour réecrir un module importé via la méthode importModules, ajouter ceci dans la configuration du plugin

```js
export const config = {
  rewrite: {
    modules: {
      'midgar-mongoose-models': {
        // Type de module

        '@midgar/mongo': {
          // nom du plugin a réecrire
          'migration.model.js': './rewrite/models/migration.model.js' // chemin du fichier a réecrire: chemin du module de remplacement
        }
      }
    }
  }
}
```

Lors de l'import des modules, le modules **./rewrite/models/user.js** sera chargé à la place du modules **user.js** contenu dans le dossier **midgar-mongoose-models** et pour le plugin **@midgar/graphql-auth**

### Réécriture et plugin local

La réecriture n'est pas supporté pour les plugins locaux. Les plugins locaux doivent etre uniquement utilisé pour le développement et les testes. Lorsque Midgar charge un plugin local, il utilise les fichiers du dossier local et non le dossier node_modules. Si un autre plugin import un module directement par son chemin, node importera le fichier dans le dossier node_modules.

## Cli

Voici les commandes de base du cli

### init:

```bash
$ midgar init ./mon-projet
```

Crée un projet Midgar dans le dossier ./mon-projet.

### new:

```bash
$ midgar new
```

Crée un nouveau plugin local.

### add:

```bash
$ midgar add monplugin
```

Ajoute un plugin au fichier **plugins.json** contenu dans le dossier de configuration du projet.

### rm:

```bash
$ midgar rm @migar/service
```

Supprime le plugin @migar/service du fichier **plugins.json**.

### enable:

```bash
$ midgar enable @migar/service
```

Active un plugin présent dans le fichier plugins.json.
Si le plugin n'est pas présen, il n'est pas ajouté et un avertisement est affiché.

### disable:

```bash
$ midgar disable @migar/service
```

Désactive le plugin @migar/service dans le fichier plugins.json.
Si le plugin n'est pas présent, il n'est pas ajouté et un avertisement est affiché.

### Paramètre optionnel:

```bash
$ midgar add @migar/service --config ~/mon-projet/src/config
```

Vous pouvez ajouter le chemin de la configuration du projet au cli.
Par defaut, le cli cherche un fichier .midrc contenant le chemin de la configuration.
S'il ne trouve pas ce fichier il cherche dans ./config.

Vous pouvez voir un exemple de fichier .midgarrc.js [ici](https://github.com/midgarjs/midgar/blob/master/templates/project/.midgarrc.js)
