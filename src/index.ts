import { Command } from "commander";
import { fileSync as findSync } from "find";
import fs from "fs";
import path from "path";
import YAML from "yaml";

const program = new Command();

program
  .option("-o, --output <path>", "output path")
  .option("-f, --file <path>", "file path")
  .option("-z, --zip", "zip build")
  .option("-e, --extension <extension>", "extension file", ".js,.ts");

program.parse();

const options = program.opts();

console.log(findSync("src/", process.cwd()));

const file = fs.readFileSync(path.resolve(process.cwd(), options.file), "utf8");

const parsedYaml = YAML.parse(file);

function parsePathHandler(handler: string) {
  const splitedPath = handler.split("/");
  const handlePath = splitedPath.pop();
  console.log("handlePath", handlePath);
  let filename = handlePath?.split(".");
  filename?.pop();
  console.log("filename", filename);
  splitedPath.push(`${filename?.join(".")}`);
  const filePath = splitedPath.join("/");
  console.log("filePath", filePath);
  console.log("regexFileName", filePath);
  const extensions = /\.[t|j]s$/;
  return findSync(new RegExp(filePath + extensions.source));
}

function parseFunctionsObject(functionsObject: any) {
  return Object.entries(functionsObject).map(([name, props]: any) => ({
    name,
    path: parsePathHandler(props.handler),
  }));
}

console.log(parseFunctionsObject(parsedYaml.functions));
