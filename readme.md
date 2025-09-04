# Prueba BackEnd

## Descargar repositorio 🚀

Para poder descargar el repositorio en su maquina vamos a ejecutar el siguiete comando en la carpeta donde se va a alojar el repositorio

```bash
git clone https://github.com/araquebarrerag/prueba-backend
```

## BackEnd

Este proyecto fue realizado con node js la aprte de back, y con docker y lambdas

### Correr Contenedores Docker

Primerp vamos a correr este comando desde la carpeta raiz, el cual nos va a instalar las dependencias para poder ejecutar los contenedores

```bash
docker-compose build
```

Seguidamente vamos a ejecutar los contenedores

```bash
docker-compose up -d
```

Estos dos comandos nos haran lo siguiente:

* Crear un contenedor db con MySQL 8.
* Cargar schema.sql y seed.sql automáticamente.
* Levantar Customers API en http://localhost:3001.
* Levantar Orders API en http://localhost:3004.

### Correr Lambda

Cuando ya tenemos levantados los contenedores de las api y de la db, vamos a ingresar a la carpeta [lambda-orchestrator] y ejecutamos el siguiente comando

```bash
npm run dev
```

Con este comando vamos a ejecutar la lambda con serverless offline en http://localhost:3002.

Despues de ejecutar este comando podemos realizar pruebas en postman con:
* API de Customers en http://localhost:3001.
* API de Orders en http://localhost:3004.
* Lambda en http://localhost:3002.