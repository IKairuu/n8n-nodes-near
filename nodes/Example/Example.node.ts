/* eslint-disable @n8n/community-nodes/options-sorted-alphabetically */
/* eslint-disable n8n-nodes-base/node-class-description-name-miscased */
/* eslint-disable n8n-nodes-base/node-param-description-missing-final-period */
/* eslint-disable @n8n/community-nodes/require-node-api-error */
/* eslint-disable @n8n/community-nodes/require-node-description-fields */
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { connect, keyStores, KeyPair, utils } from 'near-api-js';
import type { KeyPairString } from 'near-api-js/lib/utils';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class Example implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NEAR',
		name: 'NEAR',
		icon: { light: 'file:near-logo-dark.svg', dark: 'file:near-logo-light.svg' },
		group: ['input'],
		version: 1,
		description: 'Basic Example Node',
		defaults: {
			name: 'NEAR',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
		{
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			options: [
			{ name: 'View Balance', 
				value: 'viewBalance', 
				description: 'Get the NEAR balance of an account', 
				action: 'View balance' 
			},
			{ 
				name: 'Call Contract Method', 
				value: 'callMethod', 
				description: 'Sign and send a call to a smart contract', 
				action: 'Call contract method' },
			],
			default: 'viewBalance',
		},
		{
			displayName: 'Account ID',
			name: 'accountId',
			type: 'string',
			default: '',
			placeholder: 'alice.testnet',
			description: 'The NEAR account to check',
			displayOptions: { 
				show: { 
					operation: ['viewBalance'] 
				} 
			},
		},
		{
			displayName: 'Contract ID',
			name: 'contractId',
			type: 'string',
			default: '',
			placeholder: 'usdc.fakes.testnet',
			description: 'The NEAR account ID of the smart contract to call',
			displayOptions: { 
				show: { 
					operation: ['callMethod'],
				} 
			},
		},
		{
			displayName: 'Method Name',
			name: 'methodName',
			type: 'string',
			default: '',
			placeholder: 'ft_transfer',
			description: 'The contract method to call',
			displayOptions: { 
				show: { 
					operation: ['callMethod'] 
				} 
			},
		},
		{
			displayName: 'Arguments',
			name: 'args',
			type: 'json',
			default: '{}',
			description: 'Arguments for the method, as JSON',
			displayOptions: { 
				show: { 
					operation: ['callMethod'] 
				} 
			},
		},
		{
			displayName: 'Deposit (NEAR)',
			name: 'deposit',
			type: 'string',
			default: '0',
			description: 'NEAR to attach. Use 0.000000000000000000000001 (1 yocto) for ft_transfer',
			displayOptions: { 
				show: { 
					operation: ['callMethod'] 
				} 
			},
		},
		{
			displayName: 'Gas (TGas)',
			name: 'gas',
			type: 'number',
			default: 30,
			displayOptions: { 
				show: { 
					operation: ['callMethod'] 
				} 
			},
		},
		],
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `myString` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		let operation: string;
		let accountId: string;
		let contractId: string;
		let methodName: string;
		let argument: JsonObject;
		let deposit: string;
		let gas: number;

		// Iterates over all input items and add the key "myString" with the
		// value the parameter "myString" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		const creds = await this.getCredentials('nearApi');
		const networkId = creds.network as string;
		const signerId = creds.accountId as string;
		const nodeUrl =
			(creds.rpcUrl as string) ||
			(networkId === 'mainnet' ? 'https://free.rpc.fastnear.com' : 'https://test.rpc.fastnear.com');

		const keyStore = new keyStores.InMemoryKeyStore();
		await keyStore.setKey(networkId, signerId, KeyPair.fromString(creds.privateKey as KeyPairString));
		const near = await connect({ networkId, nodeUrl, keyStore });
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				operation = this.getNodeParameter('operation', itemIndex) as string;
				item = items[itemIndex];

				if (operation === 'viewBalance') {
					accountId = this.getNodeParameter('accountId', itemIndex) as string;
					const account = await near.account(accountId);
					const bal = await account.getAccountBalance();
					item.json = {
						accountId,
						available: utils.format.formatNearAmount(bal.available),
						total: utils.format.formatNearAmount(bal.total),
					};
				} else if (operation === 'callMethod') {
					contractId = this.getNodeParameter('contractId', itemIndex) as string;
					methodName = this.getNodeParameter('methodName', itemIndex) as string;
					const rawArgs = this.getNodeParameter('args', itemIndex, '{}');
					argument = (typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs) as JsonObject;
					deposit = this.getNodeParameter('deposit', itemIndex, '0') as string;
					gas = this.getNodeParameter('gas', itemIndex, 30) as number;

					const signer = await near.account(signerId);
					const result = await signer.functionCall({
						contractId,
						methodName,
						args: argument,
						gas: BigInt(gas) * BigInt(1_000_000_000_000), // TGas -> gas
						attachedDeposit: BigInt(utils.format.parseNearAmount(deposit) ?? '0'),
					});
					item.json = {
						contractId,
						methodName,
						txHash: result.transaction.hash,
						status: result.status as unknown as JsonObject,
					};
				}
			} catch (error) {
				// This node should never fail but we want to showcase how
				// to handle errors.
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [items];
	}
}
