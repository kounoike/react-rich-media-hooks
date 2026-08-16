import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const policyPath = resolve(root, ".orca/task-pr-lifecycle.json");

const runBacklog = (args) =>
    JSON.parse(
        execFileSync("backlog", args, {
            encoding: "utf8",
        }),
    );

const priorityRank = new Map([
    ["high", 0],
    ["medium", 1],
    ["low", 2],
]);

try {
    const policy = JSON.parse(readFileSync(policyPath, "utf8"));
    const maxTasks = policy.lifecycle.dispatch_selection.max_tasks;
    const listed = runBacklog([
        "task",
        "list",
        "--status",
        "To Do",
        "--ready",
        "--sort",
        "priority",
        "--json",
    ]);
    const tasks = [];

    for (const candidate of listed.tasks ?? []) {
        const view = runBacklog(["task", "view", candidate.id, "--json"]);
        const task = view.task;

        if (!task || (task.subtasks?.length ?? 0) > 0) {
            continue;
        }

        tasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            type: task.type,
            priority: task.priority,
            parentTaskId: task.parentTaskId,
            ordinal: task.ordinal,
        });
    }

    tasks.sort((left, right) => {
        const priorityDifference =
            (priorityRank.get(left.priority) ?? Number.MAX_SAFE_INTEGER) -
            (priorityRank.get(right.priority) ?? Number.MAX_SAFE_INTEGER);

        return priorityDifference || left.ordinal - right.ordinal || left.id.localeCompare(right.id);
    });

    console.log(
        JSON.stringify(
            {
                schemaVersion: 1,
                kind: "dispatchable-task-list",
                selectedTask: tasks[0] ?? null,
                selectedTasks: tasks.slice(0, maxTasks),
                tasks,
            },
            null,
            2,
        ),
    );
} catch (error) {
    console.error(`Unable to determine dispatchable tasks: ${error.message}`);
    process.exitCode = 1;
}
