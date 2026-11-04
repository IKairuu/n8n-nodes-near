/* eslint-disable n8n-nodes-base/node-class-description-name-miscased */
/* eslint-disable n8n-nodes-base/node-param-description-missing-final-period */
/* eslint-disable @n8n/community-nodes/require-node-api-error */
/* eslint-disable @n8n/community-nodes/require-node-description-fields */
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
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
			// Node properties which the user gets displayed and
			// can change on the node.
			{
				displayName: 'Contract ID',
				name: 'contractId',
				type: 'string',
				default: '',
				placeholder: 'usdc.fakes.testnet',
				description: 'The NEAR account ID of the smart contract to call',
			},
			{
				displayName: 'Method Name',
				name: 'methodName',
				type: 'string',
				default: '',
				placeholder: 'ft_transfer',
				description: 'The contract method to call, e.g. ft_transfer or get_balance'
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'number',
				default: 0,
				placeholder: '1.5',
				description: 'Amount of NEAR to attach to the call. Leave 0 for none'
			}
		],
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `myString` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		let contractId: string;
		let methodName: string;
		let amount: number;

		// Iterates over all input items and add the key "myString" with the
		// value the parameter "myString" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				contractId = this.getNodeParameter('contractId', itemIndex, '') as string;
				methodName = this.getNodeParameter('methodName', itemIndex, '') as string;
				amount = this.getNodeParameter('amount', itemIndex, '') as number;
				item = items[itemIndex];

				item.json.contractId = contractId;
				item.json.methodName = methodName;
				item.json.amount = amount;
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
