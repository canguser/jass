import { Options } from "./options";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { compare} from "../tool";

import {Program, Native, Declaration, Func, Library, Struct} from "../jass/ast";

import { Parser } from "../jass/parser";


class Pair {
  public key: string;
  public value: Program;

  constructor(key: string, value: Program) {
    this.key = key;
    this.value = value;
  }

}



class DataMap {
  private pairs: Pair[] = [];

  public put(key: string, value: Program) {
    const index = this.pairs.findIndex((pair) => compare(pair.key, key));
    if (index == -1) {
      this.pairs.push(new Pair(key, value));
    } else {
      this.pairs[index].value = value;
    }
  }

  public remove(key: string) {
    const index = this.pairs.findIndex((pair) => compare(pair.key, key));
    if (index != -1) {
      if (index == 0) {
        this.pairs.shift();
      } else if (index == this.pairs.length - 1) {
        this.pairs.pop();
      } else {
        this.pairs.splice(index, 1);
      }
    }
  }

  public get(key: string) {
    return this.pairs.find((pair) => compare(pair.key, key))
  }

  public keys() {
    return this.pairs.map((pair) => pair.key);
  }

  public values() {
    return this.pairs.map((pair) => pair.value);
  }

  public forEach(callback: (key:string, value:Program) => void) {
    this.pairs.forEach((pair) => callback(pair.key, pair.value));
  }

}

const dataMap = new DataMap();
const zincDataMap = new DataMap();

function getFileContent(filePath: string):string {
  return fs.readFileSync(filePath, {
    encoding: "utf8"
  }).toString();
}

function setSource(filePath: string, program: Program) {

  function set<T extends Declaration>(n: T) {
    if (n instanceof Program) {
      n.natives.forEach(x => {
        x.source = filePath;
      });
      n.functions.forEach(x => {
        x.source = filePath;
      });
      n.globals.forEach(x => {
        x.source = filePath;
      });
      n.structs.forEach(x => {
        x.source = filePath;
      });
      n.librarys.forEach(x => {
        x.source = filePath;
      });
    } else if (n instanceof Func) {
      n.getGlobals().forEach(x => {
        x.source = filePath;
      });
      n.locals.forEach(x => {
        x.source = filePath;
      });
    } else if (n instanceof Library) {
      n.functions.forEach(x => {
        x.source = filePath;
      });
      n.globals.forEach(x => {
        x.source = filePath;
      });
      n.structs.forEach(x => {
        x.source = filePath;
      });
    } else if (n instanceof Struct) {
      n.members.forEach(x => {
        x.source = filePath;
      });
      n.methods.forEach(x => {
        x.source = filePath;
      });
    }
  }

  [program, program.globals, program.functions, program.natives, program.librarys, program.structs,
     program.librarys.map((lib) => lib.globals).flat(),
     program.librarys.map((lib) => lib.functions).flat(),
     program.librarys.map((lib) => lib.structs).flat(),
     program.structs.map((struct) => struct.members).flat(),
     program.structs.map((struct) => struct.methods).flat(),
     program.librarys.map((lib) => lib.structs).flat().map((struct) => struct.members).flat(),
     program.librarys.map((lib) => lib.structs).flat().map((struct) => struct.methods).flat(),
     program.functions.map((func) => func.getGlobals()).flat(),
     program.librarys.map((lib) => lib.functions).flat().map((func) => func.getGlobals()).flat(),
     program.librarys.map((lib) => lib.functions).flat().map((func) => func.locals).flat(),
     program.functions.flat().map((func) => func.locals).flat(),
     program.librarys.map((lib) => lib.structs).flat().map((struct) => struct.methods).flat().map((method) => method.locals).flat(),
    ].flat().forEach(x => {
      x.source = filePath;
    });
}
function parseContent(filePath: string, content: string) {
  const program = new Parser(content).parsing();
  setSource(filePath, program);
  dataMap.put(filePath, program);
}
function parsePath(...filePaths: string[]) {
  filePaths.forEach((filePath) => {
    const content = getFileContent(filePath);
  
    parseContent(filePath, content);
  });
}
function parseZincContent(filePath: string, content: string) {
  const program = new Parser(content).zincing();
  setSource(filePath, program);
  zincDataMap.put(filePath, program);
}
function parseZincPath(...filePaths: string[]) {
  filePaths.forEach((filePath) => {
    const content = getFileContent(filePath);
  
    parseZincContent(filePath, content);
  });
}

vscode.workspace.onDidChangeConfiguration((event) => {
  parsePath(Options.commonJPath);
});
parsePath(Options.commonJPath);
parsePath(Options.blizzardJPath);
parsePath(Options.dzApiJPath);
parsePath(Options.commonAiPath);
parsePath(...Options.includes);
parsePath(...Options.workspaces);

function startWatch() {

  //#region jass and zinc
  const watcher = vscode.workspace.createFileSystemWatcher("**/*{.j,.ai,.jass}", false, false, false);
  watcher.onDidCreate((event) => {
    parsePath(event.fsPath);
  });
  watcher.onDidDelete((event) => {
    dataMap.remove(event.fsPath);
  });
  // 类似于保存，暂时未发现有其他作用
  watcher.onDidChange((event) => {
    parsePath(event.fsPath);
  });
  //#endregion
  //#region zinc
  const zincWatcher = vscode.workspace.createFileSystemWatcher("**/*.zn", false, false, false);
  zincWatcher.onDidCreate((event) => {
    parseZincPath(event.fsPath);
  });
  zincWatcher.onDidDelete((event) => {
    zincDataMap.remove(event.fsPath);
  });
  zincWatcher.onDidChange((event) => {
    parseZincPath(event.fsPath);
  });
  //#endregion

  vscode.workspace.onDidChangeTextDocument((event) => {

  });

}
startWatch();

class Data {
  public static programs() {
    return [...dataMap.values()];
  }
  public static natives() {
    return this.programs().map((program) => program.natives).flat();
  }
  public static functions() {
    return this.programs().map((program) => program.functions).flat();
  }
  public static globals() {
    return this.programs().map((program) => program.globals).flat();
  }
  public static structs() {
    return this.programs().map((program) => program.structs).flat();
  }
  public static globalVariables() {
    return this.globals().filter((global) => !global.isConstant);
  }
  public static globalConstants() {
    return this.globals().filter((global) => global.isConstant);
  }
  public static globalArrays() {
    return this.globals().filter((global) => global.isArray);
  }
  public static librarys() {
    return this.programs().map((program) => program.librarys).flat();
  }
  public static libraryGlobals() {
    return this.librarys().map((library) => library.globals).flat();
  }
  public static libraryGlobalVariables() {
    return this.libraryGlobals().filter((global) => !global.isConstant);
  }
  public static libraryGlobalConstants() {
    return this.libraryGlobals().filter((global) => global.isConstant);
  }
  public static libraryGlobalArrays() {
    return this.libraryGlobals().filter((global) => global.isArray);
  }

  public static libraryFunctions() {
    return this.librarys().map((library) => library.functions).flat();
  }
  public static libraryStructs() {
    return this.librarys().map((library) => library.structs).flat();
  }



  public static zincPrograms() {
    return [...zincDataMap.values()];
  }

  public static zincLibrarys() {
    return this.zincPrograms().map((program) => program.librarys).flat();
  }

  public static zincLibraryFunctions() {
    return this.zincLibrarys().map((library) => library.functions).flat();
  }

  public static zincLibraryStructs() {
    return this.zincLibrarys().map((library) => library.structs).flat();
  }



}

export default Data;

export {
  parseContent,
  parseZincContent
};