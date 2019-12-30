En développement ne pas utiliser en production

# Midgar
![](https://ci.midgar.io/app/rest/builds/buildType:(id:Midgar_Build)/statusIcon) [![Coverage](https://sonar.midgar.io/api/project_badges/measure?project=midgar-midgar&metric=coverage)](https://sonar.midgar.io/dashboard?id=midgar-midgar) 

## Qu'est ce que Midgar
Midgar est un framework nodejs se basant sur un système de plugin. Il permet de réaliser rapidement des applications web complexes de manière claire et structuré.

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

En soit Midgar ne fait que charger des plugins et exposer express. Sans plugin, il ne fait donc rien de concret !
L'étape suivante est donc d'installer des plugins. L'installation des plugins se fait via npm ou yarn.
L'utilisation des scripts de npm permet l'activation automatique des plugins sur le projet.

Vous pouvez voir la structure du project générer par la commande init [ici](https://github.com/midgarjs/midgar/tree/master/src/cli/.init-tpl).

## Plugins officiel

| Nom | Description |
|---------|-------------|
| [service](https://github.com/midgarjs/service) | Service avec injection de dépendances |
| [controller](https://github.com/midgarjs/controller) | Controller pour la gestion des routes  |

## Crée un plugin
Voici la structure d'un plugin:

```js
import { Plugin } from '@midgar/midgar'

/**
 * TestPlugin
 */
class TestPlugin extends Plugin {
  init () {
    // Listen @midgar/midgar:afterInit event
    this.mid.on('@midgar/midgar:afterLoadPlugins', async () => {
      // Ceci est executé une fois que tous les plugins ont été chargés
    })
  }
}

export default TestPlugin
```

Un plugin doit etre forcement accompagné d'un fichier package.json.
Pour fonctionner il doit aussi etre déclarré dans le fichier plugins.json contenu dans le dossier de configuration du projet.

Vous pouvez retouver la liste des évènement dans la [documentation](https://midgarjs.github.io/midgar/).

## Cli
Voici les commandes de base du cli

### init:

```bash
$ midgar run init ./new-project
```
Initialise un nouveau projet midgar.

### add:
```bash
$ midgar add monplugin
```
Ajoute un plugin au fichier plugins.json contenu dans le dossier de configuration du projet.

### rm:
```bash
$ midgar rm monplugin
```
Supprime un plugin du fichier plugins.json.

### enable:
```bash
$ midgar enable monplugin
```
Active un plugin présent dans le fichier plugins.json.
Si le plugin n'est pas présen, il n'est pas ajouté et un avertisement est affiché.

### disable:
```bash
$ midgar disable monplugin
```
Désactive un plugin présent dans le fichier plugins.json.
Si le plugin n'est pas présent, il n'est pas ajouté et un avertisement est affiché.

### Paramètre optionnel:

```bash
$ midgar add monplugin --config ~/mon-projet/config
```

Vous pouvez passer le chemin de la configuration au cli.
Par defaut, le cli cherche un fichier .midrc contenant le chemin de la configuration.
S'il ne trouve pas ce fichier il cherche dans ./config.

Vous pouvez voir un exemple de fichier .midrc [ici](https://github.com/midgarjs/midgar/blob/master/src/cli/.init-tpl/.midrc)
