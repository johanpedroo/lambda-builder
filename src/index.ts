#!/usr/bin/env node

// @ts-ignore
import ncc from "@vercel/ncc";
import Zip from "adm-zip";
import { Command } from "commander";
import Del from "del";
import { fileSync as findSync } from "find";
import fs from "fs";
import mkdirp from "mkdirp";
import path from "path";
import YAML from "yaml";

const program = new Command();

program
  .option("-o, --output <path>", "output path", "dist")
  .option("-f, --file <path>", "file path")
  .option("-i, --individually", "build individually lambdas")
  .option("-z, --zip", "zip build")
  .option("-m, --map", "generate .map file");

program.parse();

const options = program.opts();

const fileYml = fs.readFileSync(
  path.resolve(process.cwd(), options.file),
  "utf8"
);

const parsedYaml = YAML.parse(fileYml);

function parsePathHandler(handler: string) {
  const { dir, name } = path.parse(handler);
  const extensions = /(\/index)?\.[t|j]s$/;
  const regexFileName = new RegExp(name + extensions.source);
  const [existsFile] = findSync(regexFileName, dir);
  if (!existsFile) throw new Error("File not Exists");

  return {
    filename: path.parse(existsFile).base,
    filePath: existsFile,
    folderPath: dir,
  };
}

function parseFunctionsObject(functionsObject: any) {
  return Object.entries(functionsObject)
    .filter(([_, props]) => !(props as any).ignore)
    .map(([name, props]: any) => {
      const { filePath, folderPath, filename } = parsePathHandler(
        props.handler
      );
      return {
        name,
        filename,
        folder: folderPath,
        path: filePath,
      };
    });
}

async function buildFiles() {
  const files = parseFunctionsObject(parsedYaml.functions);

  mkdirp.sync(path.resolve(process.cwd(), options.output));

  Del.sync(options.output, { cwd: process.cwd() });

  files.map(async (file) => {
    const build = await ncc(path.resolve(process.cwd(), file.path), {
      externals: ["aws-sdk"],
      // provide a custom cache path or disable caching
      cache: false,
      // externals to leave as requires of the build
      // directory outside of which never to emit assets
      filterAssetBase: process.cwd(), // default
      minify: true, // default
      sourceMap: false, // default
      assetBuilds: false, // default
      sourceMapBasePrefix: "../", // default treats sources as output-relative
      // when outputting a sourcemap, automatically include
      // source-map-support in the output file (increases output by 32kB).
      sourceMapRegister: false, // default
      watch: false, // default
      license: "", // default does not generate a license file
      v8cache: false, // default
      quiet: true, // default
      debugLog: false, // default
    });

    const outputFolderArgs = [process.cwd(), options.output, file.folder];

    if (options.individually) outputFolderArgs.splice(2, 0, file.name);

    const outputFolder = path.resolve(...outputFolderArgs);
    const outputFilename = path.parse(file.filename).name + ".js";

    mkdirp.sync(outputFolder);

    fs.writeFileSync(path.resolve(outputFolder, outputFilename), build.code);

    if (options.zip && options.individually) {
      const zip = new Zip();

      zip.addLocalFolder(path.resolve(options.output, file.name));
      await zip.writeZipPromise(
        path.resolve(options.output, `${file.name}.zip`)
      );
    }
  });
}

buildFiles().then(async () => {
  if (options.zip && !options.individually) {
    const zip = new Zip();
    zip.addLocalFolder(path.resolve(options.output));
    await zip.writeZipPromise(path.resolve(options.output, "latest.zip"));
  }
});
