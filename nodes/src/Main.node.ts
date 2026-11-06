/* eslint-disable @n8n/community-nodes/no-restricted-imports */
/* eslint-disable n8n-nodes-base/node-param-options-type-unsorted-items */
/* eslint-disable @n8n/community-nodes/no-credential-reuse */
/* eslint-disable @n8n/community-nodes/valid-credential-references */
/* eslint-disable @n8n/community-nodes/options-sorted-alphabetically */
/* eslint-disable n8n-nodes-base/node-class-description-name-miscased */
/* eslint-disable n8n-nodes-base/node-param-description-missing-final-period */
/* eslint-disable @n8n/community-nodes/require-node-api-error */
/* eslint-disable @n8n/community-nodes/require-node-description-fields */
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { connect, keyStores, KeyPair, providers, utils } from 'near-api-js';
import type { KeyPairString } from 'near-api-js/lib/utils';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { ACTIONS, toYocto } from './actions';

// View operations are free reads, so they hide the Gas field.
const VIEW_OPS = ['getLimits', 'getMembers', 'getJob', 'getBids'];
const JOB_ID_OPS = ['award', 'bid', 'complete', 'getJob', 'getBids'];

const TGAS = BigInt(1_000_000_000_000); // 1 TGas = 10^12 gas

export class Main implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NEAR',
		name: 'NEAR',
		icon: { light: 'file:near-logo-dark.svg', dark: 'file:near-logo-light.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'NEAR accounts and the Payroll contract',
		defaults: {
			name: 'NEAR',
		},
		credentials: [{ name: 'nearApi', required: true }],
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			// ================= Resource =================
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Payroll', value: 'payroll' },
					{ name: 'Job', value: 'job' },
					{ name: 'Contract (Advanced)', value: 'contract' },
				],
				default: 'payroll',
			},

			// ================= Operations (one dropdown per resource) =================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['account'] } },
				options: [
					{
						name: 'View Balance',
						value: 'viewBalance',
						description: 'Get the NEAR balance of an account',
						action: 'View balance',
					},
					{
						name: 'Send NEAR',
						value: 'sendNear',
						description: 'Transfer NEAR from the credential account (e.g. to fund the payroll contract)',
						action: 'Send NEAR',
					},
				],
				default: 'viewBalance',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['payroll'] } },
				options: [
					{ name: 'Add Member', value: 'addMember', description: 'Owner only. Calls add_member', action: 'Add a payroll member' },
					{ name: 'Set Limits', value: 'setLimits', description: 'Owner only. Calls set_limits', action: 'Set payroll limits' },
					{ name: 'Pause / Unpause', value: 'pause', description: 'Owner only. Calls pause', action: 'Pause or unpause payroll' },
					{ name: 'Pay Member', value: 'pay', description: 'Boss. Calls pay', action: 'Pay a member' },
					{ name: 'Get Limits', value: 'getLimits', description: 'Free read. Calls get_limits', action: 'Get payroll limits' },
					{ name: 'Get Members', value: 'getMembers', description: 'Free read. Calls get_members', action: 'Get payroll members' },
				],
				default: 'pay',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['job'] } },
				options: [
					{ name: 'Post Job', value: 'postJob', description: 'Boss. Calls post_job', action: 'Post a job' },
					{ name: 'Award Job', value: 'award', description: 'Boss. Calls award', action: 'Award a job' },
					{ name: 'Place Bid', value: 'bid', description: 'Worker. Calls bid', action: 'Place a bid' },
					{ name: 'Complete Job', value: 'complete', description: 'Worker (winner). Calls complete', action: 'Complete a job' },
					{ name: 'Get Job', value: 'getJob', description: 'Free read. Calls get_job', action: 'Get a job' },
					{ name: 'Get Bids', value: 'getBids', description: 'Free read. Calls get_bids', action: 'Get bids for a job' },
				],
				default: 'postJob',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['contract'] } },
				options: [
					{
						name: 'Call Contract Method',
						value: 'callMethod',
						description: 'Sign and send a call to any smart contract',
						action: 'Call contract method',
					},
					{
						name: 'View Contract Method',
						value: 'viewMethod',
						description: 'Free read of any view method',
						action: 'View contract method',
					},
				],
				default: 'callMethod',
			},

			// ================= Account fields =================
			{
				displayName: 'Account ID',
				name: 'accountId',
				type: 'string',
				default: '',
				placeholder: 'alice.testnet',
				description: 'The NEAR account to check',
				displayOptions: { show: { resource: ['account'], operation: ['viewBalance'] } },
			},
			{
				displayName: 'Receiver ID',
				name: 'receiverId',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'payroll.account.testnet',
				displayOptions: { show: { resource: ['account'], operation: ['sendNear'] } },
			},
			{
				displayName: 'Amount (NEAR)',
				name: 'sendAmount',
				type: 'number',
				default: 0,
				required: true,
				typeOptions: { minValue: 0, numberPrecision: 4 },
				displayOptions: { show: { resource: ['account'], operation: ['sendNear'] } },
			},

			// ================= Payroll + Job shared =================
			{
				displayName: 'Payroll Contract ID',
				name: 'payrollContractId',
				type: 'string',
				default: 'payroll.account.testnet',
				required: true,
				hint: 'Use your testnet contract, e.g. payroll.account.testnet',
				displayOptions: { show: { resource: ['payroll', 'job'] } },
			},

			// ================= Payroll fields =================
			{
				displayName: 'Member Account ID',
				name: 'memberId',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'account.testnet',
				displayOptions: { show: { resource: ['payroll'], operation: ['addMember'] } },
			},
			{
				displayName: 'Daily Cap (NEAR)',
				name: 'dailyCap',
				type: 'number',
				default: 5,
				required: true,
				typeOptions: { minValue: 0, numberPrecision: 4 },
				displayOptions: { show: { resource: ['payroll'], operation: ['setLimits'] } },
			},
			{
				displayName: 'Max Per Payment (NEAR)',
				name: 'maxPerPayment',
				type: 'number',
				default: 1,
				required: true,
				typeOptions: { minValue: 0, numberPrecision: 4 },
				displayOptions: { show: { resource: ['payroll'], operation: ['setLimits'] } },
			},
			{
				displayName: 'Paused',
				name: 'paused',
				type: 'boolean',
				default: true,
				description: 'Whether to stop all payouts (on) or resume them (off)',
				displayOptions: { show: { resource: ['payroll'], operation: ['pause'] } },
			},
			{
				displayName: 'Recipient',
				name: 'recipient',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'account.testnet',
				description: 'Must already be a payroll member',
				displayOptions: { show: { resource: ['payroll'], operation: ['pay'] } },
			},
			{
				displayName: 'Amount (NEAR)',
				name: 'amount',
				type: 'number',
				default: 0,
				required: true,
				typeOptions: { minValue: 0, numberPrecision: 4 },
				displayOptions: { show: { resource: ['payroll'], operation: ['pay'] } },
			},
			{
				displayName: 'Memo',
				name: 'memo',
				type: 'string',
				default: '',
				placeholder: 'October salary',
				description: 'Optional. Shows up in the transaction logs',
				displayOptions: { show: { resource: ['payroll'], operation: ['pay'] } },
			},

			// ================= Job fields =================
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				placeholder: 'Write a landing page headline',
				displayOptions: { show: { resource: ['job'], operation: ['postJob'] } },
			},
			{
				displayName: 'Budget (NEAR)',
				name: 'budget',
				type: 'number',
				default: 0,
				required: true,
				typeOptions: { minValue: 0, numberPrecision: 4 },
				displayOptions: { show: { resource: ['job'], operation: ['postJob'] } },
			},
			{
				displayName: 'Job ID',
				name: 'jobId',
				type: 'number',
				default: 1,
				required: true,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['job'], operation: JOB_ID_OPS } },
			},
			{
				displayName: 'Winner Account ID',
				name: 'winner',
				type: 'string',
				default: '',
				placeholder: 'account.testnet',
				description: 'Optional. Leave empty and the lowest bid wins',
				displayOptions: { show: { resource: ['job'], operation: ['award'] } },
			},
			{
				displayName: 'Price (NEAR)',
				name: 'price',
				type: 'number',
				default: 0,
				required: true,
				typeOptions: { minValue: 0, numberPrecision: 4 },
				description: 'Your bid. Must be above 0 and not more than the job budget',
				displayOptions: { show: { resource: ['job'], operation: ['bid'] } },
			},

			// ================= Contract (advanced fallback) =================
			{
				displayName: 'Contract ID',
				name: 'contractId',
				type: 'string',
				default: '',
				placeholder: 'usdc.fakes.testnet',
				description: 'The NEAR account ID of the smart contract to call',
				displayOptions: { show: { resource: ['contract'] } },
			},
			{
				displayName: 'Method Name',
				name: 'methodName',
				type: 'string',
				default: '',
				placeholder: 'ft_transfer',
				description: 'The contract method to call',
				displayOptions: { show: { resource: ['contract'] } },
			},
			{
				displayName: 'Arguments',
				name: 'args',
				type: 'json',
				default: '{}',
				description: 'Arguments for the method, as JSON',
				displayOptions: { show: { resource: ['contract'] } },
			},
			{
				displayName: 'Deposit (NEAR)',
				name: 'deposit',
				type: 'string',
				default: '0',
				description: 'NEAR to attach. Use 0.000000000000000000000001 (1 yocto) for ft_transfer',
				displayOptions: { show: { resource: ['contract'], operation: ['callMethod'] } },
			},

			// ================= Gas (every signed call) =================
			{
				displayName: 'Gas (TGas)',
				name: 'gas',
				type: 'number',
				default: 30,
				description: 'Enter 30, not raw gas',
				displayOptions: {
					show: { resource: ['payroll', 'job', 'contract'] },
					hide: { operation: [...VIEW_OPS, 'viewMethod'] },
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		const creds = await this.getCredentials('nearApi');
		const networkId = creds.network as string;
		const signerId = creds.accountId as string;
		const nodeUrl =
			(creds.rpcUrl as string) ||
			(networkId === 'mainnet' ? 'https://free.rpc.fastnear.com' : 'https://test.rpc.fastnear.com');

		const keyStore = new keyStores.InMemoryKeyStore();
		await keyStore.setKey(networkId, signerId, KeyPair.fromString(creds.privateKey as KeyPairString));
		const near = await connect({ networkId, nodeUrl, keyStore });
		const signer = await near.account(signerId);
		const explorer = (hash: string) =>
			`https://${networkId === 'mainnet' ? '' : 'testnet.'}nearblocks.io/txns/${hash}`;

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const spec = ACTIONS[`${resource}.${operation}`];

				// ---------- Payroll / Job: typed methods, args built from fields ----------
				if (spec) {
					const contractId = String(this.getNodeParameter('payrollContractId', i)).trim();
					const args = spec.args(this, i);

					if (spec.kind === 'view') {
						const result = await signer.viewFunction({ contractId, methodName: spec.method, args });
						out.push({ json: { contractId, method: spec.method, args, result }, pairedItem: i });
						continue;
					}

					const tgas = this.getNodeParameter('gas', i, 30) as number;
					const outcome = await signer.functionCall({
						contractId,
						methodName: spec.method,
						args,
						gas: BigInt(Math.round(tgas)) * TGAS,
						attachedDeposit: BigInt(spec.deposit ?? '0'),
					});
					const txHash = outcome.transaction.hash as string;
					out.push({
						json: {
							contractId,
							method: spec.method,
							args,
							signer: signerId,
							txHash,
							explorer: explorer(txHash),
							result: providers.getTransactionLastResult(outcome) as IDataObject,
						},
						pairedItem: i,
					});
					continue;
				}

				// ---------- Account ----------
				if (resource === 'account' && operation === 'viewBalance') {
					const accountId = this.getNodeParameter('accountId', i) as string;
					const account = await near.account(accountId);
					const bal = await account.getAccountBalance();
					out.push({
						json: {
							accountId,
							available: utils.format.formatNearAmount(bal.available),
							total: utils.format.formatNearAmount(bal.total),
						},
						pairedItem: i,
					});
				} else if (resource === 'account' && operation === 'sendNear') {
					const receiverId = String(this.getNodeParameter('receiverId', i)).trim();
					const amount = this.getNodeParameter('sendAmount', i) as number;
					const outcome = await signer.sendMoney(receiverId, BigInt(toYocto(amount)));
					const txHash = outcome.transaction.hash as string;
					out.push({
						json: { from: signerId, to: receiverId, amountNear: amount, txHash, explorer: explorer(txHash) },
						pairedItem: i,
					});

					// ---------- Contract (advanced, raw JSON args) ----------
				} else if (resource === 'contract') {
					const contractId = this.getNodeParameter('contractId', i) as string;
					const methodName = this.getNodeParameter('methodName', i) as string;
					const rawArgs = this.getNodeParameter('args', i, '{}');
					const args = (typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs) as JsonObject;

					if (operation === 'viewMethod') {
						const result = await signer.viewFunction({ contractId, methodName, args });
						out.push({ json: { contractId, methodName, result }, pairedItem: i });
					} else {
						const deposit = this.getNodeParameter('deposit', i, '0') as string;
						const gas = this.getNodeParameter('gas', i, 30) as number;
						const outcome = await signer.functionCall({
							contractId,
							methodName,
							args,
							gas: BigInt(Math.round(gas)) * TGAS,
							attachedDeposit: BigInt(utils.format.parseNearAmount(deposit) ?? '0'),
						});
						const txHash = outcome.transaction.hash as string;
						out.push({
							json: {
								contractId,
								methodName,
								txHash,
								explorer: explorer(txHash),
								status: outcome.status as unknown as JsonObject,
							},
							pairedItem: i,
						});
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${resource}.${operation}`, {
						itemIndex: i,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: i });
					continue;
				}
				if (error.context) {
					error.context.itemIndex = i;
					throw error;
				}
				throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
			}
		}

		return [out];
	}
}
