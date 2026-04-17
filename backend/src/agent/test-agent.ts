import { Agent } from './agent';

async function run() {
  const agent = new Agent({ workspaceId: "123", userId: "abc" });
  console.log(await agent.evaluate("What is the speed of light?"));
}

run();
