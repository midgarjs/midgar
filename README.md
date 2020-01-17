## En développement ne pas utiliser en production

[![Build Status](https://drone.midgar.io/api/badges/Midgar/midgar/status.svg)](https://drone.midgar.io/Midgar/midgar)
[![Coverage](https://sonar.midgar.io/api/project_badges/measure?project=Midgar-midgar&metric=coverage)](https://sonar.midgar.io/dashboard?id=Midgar-midgar)

# Midgar

## Qu'est ce que Midgar

Midgar est un framework nodejs modulaire utilisant le pattern Model View-Controller Service (MVCS).
Il se base sur un système de plugin pour permetre de réaliser rapidement des applications web complexes de manière claire et structuré.

npm
## Installation

```sh
$ npm install -g @midgar/midgar
```

## Utilisation

Le moyen le plus rapide de démarrer avec Midgar est d'utiliser le CLI pour générer la structure d'un projet.

```bash
$ midgar init ~/my-project/
$ cd ~/my-project/
$ npm i
```

En soit Midgar ne fait que charger des plugins, sans plugin, il ne fait donc rien de concret !
L'étape suivante est donc d'installer des plugins. L'installation des plugins se fait via npm ou yarn.
L'utilisation des scripts de npm permet l'activation automatique des plugins sur le projet.

Vous pouvez voir la structure du project générer par la commande init [ici](https://github.com/midgarjs/midgar/tree/master/src/cli/.init-tpl).


## Documentation
[documentation Api](https://midgarjs.github.io/midgar/).

## Plugins officiel

| Nom | Description |
|---------|-------------|
| [service](https://github.com/midgarjs/service) | Système de services avec injection de dépendances. |
| [express](https://github.com/midgarjs/express) | Service [Express](https://expressjs.com/). |
| [controller](https://github.com/midgarjs/controller) | Système de controller avec injection de service pour la gestion des routes d'express.  |
| [migrate](https://github.com/midgarjs/migrate) | Service de migration |
| [mongo](https://github.com/midgarjs/mongo) | Service [Mongoose](https://mongoosejs.com/) avec chargement des models et migrations.  |
| [graphql-server](https://github.com/midgarjs/graphql-server) | Service [Apollo server](https://www.apollographql.com/) avec chargement des schémas et resolvers. Resolvers avec injection de service. |


## Cli

Voici les commandes de base du cli


### init:

```bash
$ midgar run init ./mon-project
```
Initialise un nouveau projet midgar.


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

Vous pouvez voir un exemple de fichier .midrc [ici](https://github.com/midgarjs/midgar/blob/master/src/cli/.init-tpl/.midrc)


## Créer un plugin

### Fichier plugin

Voici un exemple de fichier plugin:

```js
import { Plugin } from '@midgar/midgar'

export default class TestPlugin extends Plugin {
  init () {
    this.mid.on('@midgar/midgar:afterLoadPlugins', async () => {
      // Ceci est exécuté une fois que tous les plugins ont été chargés
    })
  }
}
```
Vous pouvez retouver la liste des évènements dans la [documentation](https://midgarjs.github.io/midgar/).


### Package npm

Un plugin est en premier lieu un package npm et doit etre forcement accompagné d'un fichier **package.json**. Le main du **package.json** doit pointer sur le fichier plugin.

Pour fonctionner il doit aussi etre déclarré dans le fichier **plugins.json** contenu dans le dossier de configuration du projet. Les scripts postinstall et preuninstall peuvent être utiliser pour ajouter/supprimer automatiquement les plugins du fichier **plugins.json**.


### Configuration du plugin

Vous pouvez ajouter un fichier **plugin-config.js** dans le même dossier que le fichier plugin.

Ce fichier est charger avant le chargement des plugins et est injecté dans le membre **.config** de l'instance du plugin.


### Modules

Le système de plugin comprend un importer de modules.
Vous pouvez déclarrer un type de modules a importer dans la methode init de votre plugin:

```js
import { Plugin } from '@midgar/midgar'

export default class TestPlugin extends Plugin {
  init () {
    this.pm.addModuleType('mon-type', 'mondossier')
  }
}
```
***mon-type*** corréspond à l'identifiant du type de module.
***modossier*** corréspond au chemin par défaut du dossier contenant ce type de modules.

@see: https://midgarjs.github.io/midgar/PluginManager.html#addModuleType__anchor

Pour importer les modules:

```js
import { Plugin } from '@midgar/midgar'

export default class TestPlugin extends Plugin {
  init () {
    this.mid.on('@midgar/midgar:afterLoadPlugins', async () => {
      const files = await this.mid.pm.importModules('mon-type')
      ...
    })
  }
}
```
@see: https://midgarjs.github.io/midgar/PluginManager.html#importModules__anchor

La méthode importModules importe tous les modules **mon-typer** pour tous les plugins.
Le chemin du dossier **mon-type** est par défaut **./mondossier/** relativement par rapport au fichier plugin.

La méthode importModules renvoit un tableau d'object:

```js
[
  {
    path: '~/mon-projet/src/plugins/test-plugin/mondossier/fichier.js',
    export: ... // La valeur export default du fichier
    plugin: 'test-plugin',
    relativePath: 'fichier.js'
  },
  ...
}
```

Le chemin du dossier **mon-type** peut etre configuré pour chaque plugin dans le fichier  **plugin-config.js**:

```js
export default {
  modules: {
    'mon-type': 'mon/nouveau/dossier',
  }
}
```


### Réecriture

Si un plugin ne fait pas axactement ce dont vous avez besoin, ou bien si vous voulez enrichir les fonctionnalitées d'un plugin, vous pouvez utiliser le système de réecture.
Les plugins ainsi que les modules importé via la méthode importModules sont réecrivable.


#### Plugin

Pour réecrire un plugin, ajouter ceci dans le fichier **plugin-config.js**.

```js
export default {
    rewrite:{
      plugin: '@midgar/service'
    }
  }
}
```

Lors du chargement des plugins, ce plugin sera chargé à la place du plugin **@midgar/service**.

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

Pour réecrir un module importé via la méthode importModules, ajouter ceci dans le fichier **plugin-config.js**.

```js
export default {
  rewrite: {
    modules: {
      "midgar-mongoose-models": { // Type de module
        "@midgar/graphql-auth": { // nom du plugin a réecrire
          'user.js': './rewrite/models/user.js' // chemin du fichier a réecrire: chemin du module de remplacement
        }
      }
    }
  }
}
```

Lors de l'import des modules, le modules **./rewrite/models/user.js** sera chargé à la place du modules **user.js** contenu dans le dossier **midgar-mongoose-models** et pour le plugin **@midgar/graphql-auth**
