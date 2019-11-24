<p align="right">
<a href="README.md">English description</a> | Описание на русском
</p>

# Webpack-npm-dependencies-analyzer

Webpack-плагин, который позволяет получить список зависимостей для всех пакетов, которые перечислены в package.json.

## Установка

Установка с npm:

```bash
npm install --save-dev webpack-npm-dependencies-analyzer
```

Установка с yarn:

```bash
yarn add webpack-npm-dependencies-analyzer --dev
```

## Подключение

```js
const WebpackNpmDependenciesAnalyzer = require('webpack-npm-dependencies-analyzer');

// Добавляем в список плагинов, которые запустятся в production-сборке
const config = {
  plugins: [
    new WebpackNpmDependenciesAnalyzer({
      // Путь до файла с результами. По умолчанию берется output.path
      filename: '../res.json',
      // Путь до package.json
      packageJsonPath: './package.json',
    }),
  ],
};
```

## Результат

Представим, что в проекте есть `react` и `react-dom`. Тогда результат будет таким:

```json
{
  "react": ["object-assign"],
  "react-dom": ["object-assign", "scheduler"]
}
```

## Для чего это может быть полезно?

Например, когда сплитим вендоры на более мелкие чанки. Представим, что у нас есть вот такой список зависимостей:

```json
"dependencies": {
  "react": "16.11.0",
  "react-dom": "16.11.0",
  "redux": "4.0.4",
  "redux-thunk": "2.3.0",
  "react-redux": "5.1.2",
  "sanitize.css": "7.0.3",
  "serve": "10.1.2",
  "date-fns": "2.7.0"
},
```

Мы можем доставить каждый npm-пакет в отдельном чанке. Вот [ссылка на оригинальное исследование](https://medium.com/hackernoon/the-100-correct-way-to-split-your-chunks-with-webpack-f8a9df5b7758). Но у вас может быть много пакетов. Для HTTP/2 в целом это не проблема. Если же у вас много клиентов с HTTP/1, либо ваши метрики показывают не лучший результат такого деления, можно сгруппировать npm-пакеты в чанки по какому-либо признаку.

Например, `react` и `react-dom` положить в чанк `react`. Такой же фокус проделаем с `redux`, а остальное положим просто в `vendor`.

Используя split-chunks-plugin получаем вот такой конфиг:

```js
vendor: {
  test: /[\\/]node_modules[\\/]/,
  enforce: true,
  chunks: 'all',
  name(module) {
    const packageName = module.context.match(
      /[\\/]node_modules[\\/](.*?)([\\/]|$)/
    )[1];

    switch (packageName) {
      case 'react':
      case 'react-dom':
        return 'react';
      case 'redux':
      case 'react-redux':
        return 'redux';
      default:
        return 'vendor';
    }
  },
},
```

Но тут есть проблема. У `react` и `react-dom` есть свои зависимости. С таким конфигом они попадут в чанк `vendor`. Значит, при обновлении `react` и `react-dom` мы можем и чанк `vendor` обновить. А нам этого не хотелось бы.

Для этого и нужен `webpack-npm-dependencies-analyzer`. Запустив его на prod-сборке мы получим зависимости `react`, `react-dom`, `redux` и `react-redux`. Тогда switch примет такой вид:

```js
switch (packageName) {
  case 'react':
  case 'react-dom':
  case 'scheduler':
  case 'object-assign':
    return 'react';
  case 'redux':
  case 'symbol-observable':
  case 'react-redux':
  case 'react-is':
  case 'invariant':
  case 'hoist-non-react-statics':
  case '@babel':
  case 'prop-types':
    return 'redux';
  default:
    return 'vendor';
}
```

Теперь, обновляя пакеты, которые не попадают в `vendor` не будут инвалидировать соседние чанки.
