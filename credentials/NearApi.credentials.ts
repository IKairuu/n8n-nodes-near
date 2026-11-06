/* eslint-disable @n8n/community-nodes/icon-validation */
/* eslint-disable @n8n/community-nodes/cred-class-field-icon-missing */
/* eslint-disable @n8n/community-nodes/credential-test-required */
import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class NearApi implements ICredentialType {
	name = 'nearApi';
	displayName = 'NEAR API';
	documentationUrl = 'https://docs.near.org';
	properties: INodeProperties[] = [
		{
			displayName: 'Account ID',
			name: 'accountId',
			type: 'string',
			default: '',
			placeholder: 'myaccount.testnet',
			required: true,
		},
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'ed25519:...',
			required: true,
		},
		{
			displayName: 'Network',
			name: 'network',
			type: 'options',
			options: [
				{ name: 'Testnet', value: 'testnet' },
				{ name: 'Mainnet', value: 'mainnet' },
			],
			default: 'testnet',
		},
		{
			displayName: 'RPC URL',
			name: 'rpcUrl',
			type: 'string',
			default: '',
			description: 'Optional. Leave empty to use FastNEAR.',
		},
	];
}