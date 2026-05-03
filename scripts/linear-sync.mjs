#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const API_URL = "https://api.linear.app/graphql";
const DEFAULT_PROJECT = "EdgeLord Minimal Labeler Execution";
const envPath = path.join(process.env.HOME ?? "", ".codex", "secrets", "linear.env");
const args = process.argv.slice(2);

function usage(exitCode = 0) {
  console.log(`Usage:
  pnpm linear:roadmap
  pnpm linear:issue -- JOE-18
  pnpm linear:comment -- JOE-18 --body-file /tmp/proof.md
  pnpm linear:start -- JOE-18
  pnpm linear:done -- JOE-18

Options:
  --project <name>        Linear project name. Default: ${DEFAULT_PROJECT}
  --limit <n>             Roadmap issue limit. Default: 50
  --json                  Print JSON instead of markdown for roadmap/issue.
  --body <text>           Comment body.
  --body-file <path>      Comment body file.
`);
  process.exit(exitCode);
}

function optionValue(name, fallback = "") {
  const equalsArg = args.find((arg) => arg.startsWith(`${name}=`));
  if (equalsArg) return equalsArg.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) {
    return args[index + 1];
  }
  return fallback;
}

function positionalArgs() {
  const optionNamesWithValues = new Set(["--project", "--limit", "--body", "--body-file"]);
  const positional = [];
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (optionNamesWithValues.has(arg)) {
      index += 1;
      continue;
    }
    if ([...optionNamesWithValues].some((name) => arg.startsWith(`${name}=`))) continue;
    if (!arg.startsWith("--")) positional.push(arg);
  }
  return positional;
}

function readLocalApiKey() {
  if (!fs.existsSync(envPath)) return "";
  const match = fs.readFileSync(envPath, "utf8").match(/^\s*(LINEAR_API_KEY|LINEAR_API_TOKEN)\s*=\s*['"]?([^'"\s]+)['"]?\s*$/m);
  return match?.[2] ?? "";
}

const apiKey = process.env.LINEAR_API_KEY || process.env.LINEAR_API_TOKEN || readLocalApiKey();

async function graphql(query, variables = {}) {
  if (!apiKey) {
    throw new Error(`Missing LINEAR_API_KEY or LINEAR_API_TOKEN. Set it in the shell or ${envPath}.`);
  }
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(JSON.stringify(payload.errors ?? payload, null, 2));
  }
  return payload.data;
}

function priority(issue) {
  if (issue.priorityLabel === "Urgent") return 1;
  if (issue.priorityLabel === "High") return 2;
  if (issue.priorityLabel === "Medium") return 3;
  if (issue.priorityLabel === "Low") return 4;
  return 5;
}

function statusRank(issue) {
  const type = issue.state?.type ?? "";
  if (type === "started") return 0;
  if (type === "unstarted") return 1;
  if (type === "backlog") return 2;
  if (type === "completed") return 4;
  if (type === "canceled") return 5;
  return 3;
}

function issueSummary(issue) {
  return {
    id: issue.identifier,
    title: issue.title,
    status: issue.state?.name ?? "",
    statusType: issue.state?.type ?? "",
    priority: issue.priorityLabel,
    milestone: issue.projectMilestone?.name ?? null,
    labels: issue.labels.nodes.map((label) => label.name),
    assignee: issue.assignee?.name ?? null,
    dueDate: issue.dueDate ?? null,
    url: issue.url,
    branch: issue.branchName ?? null,
    description: issue.description ?? "",
  };
}

function issueBlocked(issue) {
  return issue.labels.nodes.some((label) => label.name.startsWith("blocked-by"));
}

function printRoadmap(issues, json) {
  const summaries = issues.map(issueSummary);
  if (json) {
    console.log(JSON.stringify({ project: optionValue("--project", DEFAULT_PROJECT), issues: summaries }, null, 2));
    return;
  }

  console.log(`# Linear Roadmap: ${optionValue("--project", DEFAULT_PROJECT)}`);
  console.log("");
  for (const issue of summaries) {
    const labels = issue.labels.length ? ` [${issue.labels.join(", ")}]` : "";
    console.log(`- ${issue.id} ${issue.priority} ${issue.status}: ${issue.title}${labels}`);
    if (issue.milestone) console.log(`  milestone: ${issue.milestone}`);
    if (issue.dueDate) console.log(`  due: ${issue.dueDate}`);
    console.log(`  ${issue.url}`);
  }

  const next = summaries.find((issue) => issue.statusType === "started" && !issue.labels.some((label) => label.startsWith("blocked-by"))) ??
    summaries.find((issue) => issue.statusType === "unstarted" && !issue.labels.some((label) => label.startsWith("blocked-by")));
  if (next) {
    console.log("");
    console.log(`Recommended next issue: ${next.id} - ${next.title}`);
  }
}

function printIssue(issue, json) {
  const summary = issueSummary(issue);
  if (json) {
    console.log(JSON.stringify({ issue: summary }, null, 2));
    return;
  }
  console.log(`# ${summary.id}: ${summary.title}`);
  console.log("");
  console.log(`status: ${summary.status}`);
  console.log(`priority: ${summary.priority}`);
  if (summary.milestone) console.log(`milestone: ${summary.milestone}`);
  if (summary.labels.length) console.log(`labels: ${summary.labels.join(", ")}`);
  if (summary.dueDate) console.log(`due: ${summary.dueDate}`);
  console.log(`url: ${summary.url}`);
  console.log("");
  console.log("## Execution Packet");
  console.log("");
  console.log(summary.description.trim() || "(no description)");
  console.log("");
  console.log("## Repo Validation Defaults");
  console.log("");
  console.log("- `pnpm research:fixture-check` for research/report slices");
  console.log("- `pnpm closeout:minimal-labeler` before handoff");
  console.log("- `pnpm slice:minimal-labeler` when live API/data status should be included");
  console.log("");
  console.log("## Sync Rule");
  console.log("");
  console.log(`Post proof of work with: pnpm linear:comment -- ${summary.id} --body-file /tmp/proof.md`);
}

async function listRoadmap() {
  const project = optionValue("--project", DEFAULT_PROJECT);
  const limit = Number(optionValue("--limit", "50"));
  const query = `
    query Roadmap($project: String!, $first: Int!) {
      issues(
        first: $first,
        filter: {
          project: { name: { eq: $project } },
          archivedAt: { null: true }
        }
      ) {
        nodes {
          identifier
          title
          description
          priorityLabel
          dueDate
          url
          branchName
          state { name type }
          assignee { name }
          projectMilestone { name }
          labels { nodes { name } }
        }
      }
    }`;
  const data = await graphql(query, { project, first: limit });
  const issues = data.issues.nodes
    .filter((issue) => issue.state?.type !== "completed" && issue.state?.type !== "canceled")
    .sort((left, right) => statusRank(left) - statusRank(right) || priority(left) - priority(right) || Number(issueBlocked(left)) - Number(issueBlocked(right)) || left.identifier.localeCompare(right.identifier));
  printRoadmap(issues, args.includes("--json"));
}

async function getIssue(identifier) {
  const query = `
    query Issue($id: String!) {
      issue(id: $id) {
        identifier
        title
        description
        priorityLabel
        dueDate
        url
        branchName
        state { name type }
        assignee { name }
        team {
          states {
            nodes { id name type }
          }
        }
        projectMilestone { name }
        labels { nodes { name } }
      }
    }`;
  const data = await graphql(query, { id: identifier });
  if (!data.issue) throw new Error(`Linear issue not found: ${identifier}`);
  return data.issue;
}

async function showIssue() {
  const [identifier] = positionalArgs();
  if (!identifier) usage(1);
  printIssue(await getIssue(identifier), args.includes("--json"));
}

function commentBody() {
  const body = optionValue("--body", "");
  if (body) return body;
  const bodyFile = optionValue("--body-file", "");
  if (bodyFile) return fs.readFileSync(path.resolve(bodyFile), "utf8");
  throw new Error("Comment requires --body or --body-file.");
}

async function postComment() {
  const [identifier] = positionalArgs();
  if (!identifier) usage(1);
  const query = `
    mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment { id url }
      }
    }`;
  const data = await graphql(query, {
    input: {
      issueId: identifier,
      body: commentBody(),
    },
  });
  console.log(JSON.stringify(data.commentCreate, null, 2));
}

async function setIssueState(targetType) {
  const [identifier] = positionalArgs();
  if (!identifier) usage(1);
  const issue = await getIssue(identifier);
  const state = issue.team.states.nodes.find((item) => item.type === targetType);
  if (!state) throw new Error(`No ${targetType} state found for ${identifier}.`);
  const query = `
    mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue { identifier state { name type } }
      }
    }`;
  const data = await graphql(query, {
    id: identifier,
    input: { stateId: state.id },
  });
  console.log(JSON.stringify(data.issueUpdate, null, 2));
}

const command = args[0];
try {
  if (!command || command === "--help" || command === "-h") usage(0);
  if (command === "roadmap") await listRoadmap();
  else if (command === "issue") await showIssue();
  else if (command === "comment") await postComment();
  else if (command === "start") await setIssueState("started");
  else if (command === "done") await setIssueState("completed");
  else usage(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
