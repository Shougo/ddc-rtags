import {
  BaseSource,
  Candidate,
  DdcOptions,
} from "https://deno.land/x/ddc_vim@v0.13.0/types.ts#^";
import { Denops, fn } from "https://deno.land/x/ddc_vim@v0.13.0/deps.ts#^";
import { writeAll } from "https://deno.land/std@0.104.0/io/mod.ts#^";

type Completions = {
  completions: Completion[];
}

type Completion = {
  completion: string;
  brief_comment: string;
  signature: string;
  kind: string;
}

export class Source extends BaseSource<{}> {
  async gatherCandidates(args: {
    denops: Denops;
    options: DdcOptions;
    completeStr: string;
  }): Promise<Candidate[]> {
    const filename = await fn.bufname(args.denops, "%");
    const line = await fn.line(args.denops, ".");
    const column = await fn.col(args.denops, ".");
    const offset = await fn.line2byte(args.denops, line) + column - 2;
    const bufTexts = (await fn.getline(args.denops, 1, line)).slice(0, offset);
    const cmdArgs = [
      "rc",
      "--absolute-path",
      "--synchronous-completions",
      "--json",
      "-l",
      `${filename}:${line}:${column}`,
      `--unsaved-file=${filename}:${offset}`,
    ];

    const p = Deno.run({
      cmd: cmdArgs,
      stdout: "piped",
      stderr: "piped",
      stdin: "piped",
    });

    await writeAll(p.stdin, new TextEncoder().encode(bufTexts.join("\n")));
    p.stdin.close();

    const output = new TextDecoder().decode(await p.output());
    const decoded = JSON.parse(output) as Completions;

    let candidates: Candidate[] = [];
    for (const completion of decoded.completions) {
      //console.log(completion);

      let candidate: Candidate = {
        word: completion.completion,
        kind: completion.kind,
        menu: completion.brief_comment,
      };

      if (completion.completion != completion.signature) {
        candidate.menu = completion.signature;
      }

      switch (completion.kind) {
        case "FunctionDecl":
        case "CXXMethod":
          candidate.abbr = candidate.word + "(";
          break;
      }

      candidates.push(candidate);
    }

    await p.status()

    return candidates;
  }

  params(): {} {
    return {};
  }
}
