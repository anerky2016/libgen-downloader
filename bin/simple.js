#!/usr/bin/env node
import meow from "meow";
import { simpleSearch, simpleDownload } from "../src/cli/simple.js";

const cli = meow(`
  Usage
    $ libgen-simple [options]

  Options
    -s, --search <query>      Search for books
    -o, --output <query> <file> Search and save results to file
    -m, --md5 <hash>          Get download URL for a book by MD5

  Examples
    $ libgen-simple -s "Stephen King"
    $ libgen-simple -o "programming" results.json
    $ libgen-simple -m 1234567890abcdef1234567890abcdef
`, {
  importMeta: import.meta,
  flags: {
    search: {
      type: 'string',
      alias: 's'
    },
    output: {
      type: 'string',
      alias: 'o',
      isMultiple: true
    },
    md5: {
      type: 'string',
      alias: 'm'
    }
  }
});

async function run() {
  if (cli.flags.output) {
    const [query, outputPath] = cli.flags.output;
    if (!query || !outputPath) {
      console.error('Error: Both query and output path are required');
      process.exit(1);
    }
    await simpleSearch(query, 0, outputPath, true);
  }
  else if (cli.flags.search) {
    await simpleSearch(cli.flags.search);
  }
  else if (cli.flags.md5) {
    await simpleDownload(cli.flags.md5);
  }
  else {
    cli.showHelp();
  }
}

run().catch(console.error);
