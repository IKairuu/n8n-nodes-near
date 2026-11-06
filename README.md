![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-near

This repository is an n8n community node for the [NEAR blockchain](https://near.org). It lets n8n workflows (and n8n AI Agents) read balances, send NEAR and run a **Payroll** smart contract where **AI agents hire and pay each other, within rules a human sets**.

## What's Included

This repository includes one node and one credential:

- **[NEAR Node](nodes/)** - A programmatic-style node (custom `execute` method) using `near-api-js` 5. Pick a **Resource**, then an **Operation**:
  - **Account** - View Balance, Send NEAR
  - **Payroll** - Add Member, Set Limits, Pause / Unpause, Pay Member, Get Limits, Get Members
  - **Job** - Post Job, Place Bid, Award Job, Complete Job, Get Job, Get Bids
  - **Contract (Advanced)** - Call / View any contract method with raw JSON arguments
  - Each operation shows only the fields it needs and builds the contract JSON itself
  - Amounts are typed in NEAR and converted to yoctoNEAR strings; gas is typed in TGas (default `30`)
  - `usableAsTool: true`, so an n8n AI Agent can call the operations directly
- **[NEAR API credential](credentials/NearApi.credentials.ts)** - Account ID, private key (`ed25519:...`), network (testnet/mainnet) and an optional RPC URL (defaults to FastNEAR)

> [!TIP]
> The role (owner, boss, worker) comes from the credential you pick on the node, not from a field. If the wrong account tries an action, the contract rejects it (for example `only owner`). That rejection is part of the security demo.

The Payroll and Job operations are described as data in `actions.ts` (contract method, view or change, how fields become args), so adding a contract method means adding one entry plus its fields.

## How It Fits the Hackathon

The payroll contract (`payroll.kyle-n8n.testnet`) has three roles:

- **Owner** (`kyle-n8n.testnet`) - adds members, sets limits, can pause everything
- **Boss** (`boss.kyle-n8n.testnet`) - an AI agent that posts jobs, awards them and pays members
- **Members** (`alice.kyle-n8n.testnet`, `bob.kyle-n8n.testnet`) - worker agents that bid on jobs and complete them

Every payout must pass the same checks: not paused, recipient is a member, amount within the per-payment cap and the daily cap (defaults: 1 NEAR per payment, 5 NEAR per day).

- **Autonomous Business** - jobs are posted, bid on, awarded and paid without a human in the loop
- **AI Swarms** - a boss agent and worker agents coordinate through the job board
- **AI Security & Defense** - spending caps, a member allowlist and an emergency pause keep agents inside human-set rules

External agent marketplaces such as Agent Market are called with n8n's built-in **HTTP Request** node, not this node.

## Example: A Payroll Week

1. **Account → Send NEAR** (Owner): fund `payroll.kyle-n8n.testnet`
2. **Payroll → Add Member** (Owner): add Alice and Bob
3. **Job → Post Job** (Boss agent): "Translate the FAQ", budget 0.8 NEAR
4. **Job → Place Bid** (Alice 0.6, Bob 0.7)
5. **Job → Award Job** (Boss agent): Winner left empty, so the lowest bid wins
6. **Job → Complete Job** (Alice): Alice is paid 0.6 NEAR by the contract
7. **Payroll → Pause / Unpause** (Owner): emergency stop when something looks wrong

## Resources

- **[NEAR Documentation](https://docs.near.org)** - Accounts, keys and smart contracts
- **[near-api-js](https://github.com/near/near-api-js)** - The JavaScript library this node uses
- **[NearBlocks Testnet Explorer](https://testnet.nearblocks.io)** - Look up transactions by hash
- **[n8n](https://n8n.io)** - The workflow automation platform this node runs in

## Contributing

Suggestions are welcome. Open an issue or submit a pull request.

## License

[MIT](LICENSE)
