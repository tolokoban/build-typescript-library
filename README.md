# build-typescript-library

Help create ESM libraries by taking care of extensions in relative imports and extra modules (css, jpg, ...).

## Usage

```sh
build-typescript-library <path of your tsconfig.json>
```

You can also use the `watch` mode:

```sh
build-typescript-library --watch <path of your tsconfig.json>
build-typescript-library -w <path of your tsconfig.json>
```

You need a project folder with:

* `tsconfig.json`
* `src/`: with the sources to compile.

## Why do I need this?

Writing a library can be made in two main ways:

* With a bundler.
* With Typescript only.

Bundlers generate a big Javascript file with a lot of added code to deal with CommonJS, AMD, UMD, etc...
Sometimes it's hard to debug it in the browser (even with source maps), sometimes you have issues because one lib has been made with a different version of your bundler, sometimes you can not tree shake your code, ...

Typescript generates as many files as you have sources and it's doing a great job at transpiling to any target you need.
But there are two major issues to use it to build libraries:

* If you don't use `.js` extensions in your imports, they will not be added in the Javascript output where there may be needed.
* Typescript just ignore special modules, like stylesheets or images.
* Typescript don't change the paths aliases.

## What is still missing?

1. Today, `build-typescript-library` only copy the modules you import in a `.ts` or `.tsx` file.
If you have a `.css` file that uses an image, this will not be detected.
