En développement ne pas utiliser en production / In Dev don't use this

![](https://ci.midgar.io/app/rest/builds/buildType:(id:Midgar_Build)/statusIcon) [![Coverage](https://sonar.midgar.io/api/project_badges/measure?project=midgar-midgar&metric=coverage)](https://sonar.midgar.io/dashboard?id=midgar-midgar) 

## Qu'est ce que Midgar
Midgar est un framework node js se basant sur un systeme de plugin. Il permet de réaliser rapidement des applications web complexes de manière claire et structuré.

## Installation

```sh
$ npm install -g @midgar/midgar
```

## Utilisation

Le moyen le plus rapide de démarrer avec Midgar est d'utiliser le CLI pour générer la structure de l'application.

```bash
$ midgar init ~/my-project/
$ cd ~/my-project/
$ npm i
```

En soit Midgar ne fait que charger des plugins et exposer express. Sans plugin, il ne fait donc rien de concret !
L'étape suivant est donc d'installer des plugins. Midgar supporte bien évidament l'installation de plugin via npm ou yarn.


## Plugins officiel

| Nom | Description |
|---------|-------------|
| [service](https://github.com/midgarjs/service) | Service avec injection de dépendances |
| [controller](https://github.com/midgarjs/controller) | Controller pour la gestion des routes  |

[Api documentation](https://midgarjs.github.io/midgar/)

## Test unit

```bash
$ npm run test
```