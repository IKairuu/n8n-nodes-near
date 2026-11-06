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

The Payroll and Job operations are described as data in `actions.ts` (contract method, view or change, how fields become args), so adding a contract method means adding one entry plus its fields.


## Resources

- **[NEAR Documentation](https://docs.near.org)** - Accounts, keys and smart contracts
- **[near-api-js](https://github.com/near/near-api-js)** - The JavaScript library this node uses
- **[NearBlocks Testnet Explorer](https://testnet.nearblocks.io)** - Look up transactions by hash
- **[n8n](https://n8n.io)** - The workflow automation platform this node runs in

## Contributing

Suggestions are welcome. Open an issue or submit a pull request.

## License

[MIT](LICENSE)
