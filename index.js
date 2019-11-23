const { writeFileSync } = require('fs');
const path = require('path');

class NpmDependenciesAnalyzerPlugin {
  resultFilename = '';
  depNames = [];
  packages = {};

  constructor(
    options = {
      filename: 'res.json',
      packageJsonPath: './package.json',
    },
  ) {
    this.resultFilename = options.filename;
    let packageJson;
    let fullPackageJsonPath;
    try {
      fullPackageJsonPath = path.resolve(process.cwd(), options.packageJsonPath);
      packageJson = require(fullPackageJsonPath);
    } catch (error) {
      console.error(error);
      throw new Error(`
        ${this.constructor.name}.
        package.json is not found in path: ${fullPackageJsonPath}.
        Try to pass another path to packageJsonPath option.
        Current value: ${options.packageJsonPath}
      `);
    }

    this.depNames = Object.keys(packageJson.dependencies).concat(
      Object.keys(packageJson.devDependencies || {}),
    );
  }

  apply(compiler) {
    compiler.hooks.thisCompilation.tap(this.constructor.name, (compilation) => {
      compilation.hooks.optimizeChunks.tap(this.constructor.name, () => {
        if (compiler.options.mode !== 'production') {
          // tslint:disable-next-line:no-console
          compilation.warnings.push(`
            ${this.constructor.name}.
            Started not in porduction mode! It is possible, you will get invalid result.
            Start production build instead.
          `);
        }
        const outputDir = (compiler.options.output && compiler.options.output.path) || './';
        const readyPath = path.resolve(outputDir, this.resultFilename);

        for (const module of compilation.modules) {
          if (/[\\/]node_modules[\\/]/.test(module.context)) {
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];

            if (!this.packages[packageName]) {
              this.packages[packageName] = [];
            }

            this.packages[packageName] = getUniqValues(
              this.packages[packageName].concat(this.getDependencies(module)),
            );
          }
        }

        const unorderedUsedPackagesWithDependencies = Object.keys(this.packages).reduce((res, packKey) => {
          if (!this.depNames.includes(packKey)) {
            const depPacks = this.packages[packKey];

            if (!depPacks.length) {
              return res;
            }

            Object.keys(this.packages).forEach((_packKey) => {
              if (this.packages[_packKey].includes(packKey)) {
                res[_packKey] = getUniqValues(this.packages[_packKey].concat(depPacks));
              }
            });

            return res;
          }

          if (!res[packKey]) {
            res[packKey] = this.packages[packKey];
          }

          return res;
        }, {});

        const orderedUsedPackagesWithDependencies = {};
        Object.keys(unorderedUsedPackagesWithDependencies)
          .sort()
          .forEach((key) => {
            orderedUsedPackagesWithDependencies[key] = unorderedUsedPackagesWithDependencies[key].sort();
          });

        try {
          writeFileSync(readyPath, JSON.stringify(orderedUsedPackagesWithDependencies, null, 2));
        } catch (error) {
          console.error(error);
          compilation.errors.push(`
            ${this.constructor.name}.
            Error during dependeincies relationship write to file.
          `);
        }
      });
    });
  }

  getDependencies(module) {
    const result = module.dependencies.map((dep) => {
      const depRequest = dep.request;

      if (depRequest && !depRequest.startsWith('.') && !depRequest.startsWith('/')) {
        const rawRequest = depRequest.split('/')[0];
        if (!this.depNames.includes(rawRequest)) {
          return rawRequest;
        }
      }
    });

    return getUniqValues(result);
  }
}

function getUniqValues(array) {
  return array.reduce((res, key) => {
    if (!res.includes(key) && typeof key !== 'undefined') {
      res.push(key);
    }

    return res;
  }, []);
}

module.exports = NpmDependenciesAnalyzerPlugin;
