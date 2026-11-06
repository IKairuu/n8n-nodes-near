/* eslint-disable @n8n/community-nodes/no-restricted-imports */
import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { utils } from 'near-api-js';

/**
 * One entry per payroll contract method.
 * - method: the Rust function name in payroll-contract/src/lib.rs
 * - kind:   'view' = free read (no signature, no gas), 'change' = signed transaction
 * - args:   turns the n8n form fields into the JSON the contract expects
 *
 * Adding a new contract method later = one entry here + its fields in the node.
 */
export type ActionSpec = {
	method: string;
	kind: 'view' | 'change';
	deposit?: string; // yoctoNEAR to attach (none of the payroll methods need one)
	args: (ctx: IExecuteFunctions, i: number) => IDataObject;
};

// NEAR -> yoctoNEAR string. "1.5" -> "1500000000000000000000000".
// Sent as a string because Rust U128 arrives as JSON string (JS numbers lose precision).
export const toYocto = (near: number | string): string => {
	const text = String(near).trim();
	const yocto = /^\d+(\.\d+)?$/.test(text) ? utils.format.parseNearAmount(text) : null;
	if (!yocto || yocto === '0') throw new Error(`Invalid NEAR amount: "${near}" (must be a number above 0)`);
	return yocto;
};

const str = (c: IExecuteFunctions, name: string, i: number) =>
	String(c.getNodeParameter(name, i, '')).trim();
const num = (c: IExecuteFunctions, name: string, i: number) =>
	Number(c.getNodeParameter(name, i, 0));

// Account IDs are required strings; fail before signing instead of burning gas.
const accountId = (c: IExecuteFunctions, name: string, label: string, i: number) => {
	const v = str(c, name, i);
	if (!v) throw new Error(`${label} is required`);
	return v;
};

const jobId = (c: IExecuteFunctions, i: number) => {
	const id = num(c, 'jobId', i);
	if (!Number.isInteger(id) || id < 1) throw new Error('Job ID must be a whole number, 1 or higher');
	return id; // u64 in Rust, plain JSON number is fine here
};

export const ACTIONS: Record<string, ActionSpec> = {
	// ---------- Payroll: owner ----------
	'payroll.addMember': {
		method: 'add_member',
		kind: 'change',
		args: (c, i) => ({ account: accountId(c, 'memberId', 'Member Account ID', i) }),
	},
	'payroll.setLimits': {
		method: 'set_limits',
		kind: 'change',
		args: (c, i) => ({
			daily_cap: toYocto(num(c, 'dailyCap', i)),
			max_per_payment: toYocto(num(c, 'maxPerPayment', i)),
		}),
	},
	'payroll.pause': {
		method: 'pause',
		kind: 'change',
		args: (c, i) => ({ on: c.getNodeParameter('paused', i, true) as boolean }),
	},

	// ---------- Payroll: boss ----------
	'payroll.pay': {
		method: 'pay',
		kind: 'change',
		args: (c, i) => {
			const args: IDataObject = {
				to: accountId(c, 'recipient', 'Recipient', i),
				amount: toYocto(num(c, 'amount', i)),
			};
			const memo = str(c, 'memo', i);
			if (memo) args.memo = memo; // Option<String>: leave it out when empty
			return args;
		},
	},

	// ---------- Payroll: views ----------
	'payroll.getLimits': { method: 'get_limits', kind: 'view', args: () => ({}) },
	'payroll.getMembers': { method: 'get_members', kind: 'view', args: () => ({}) },

	// ---------- Job board: boss ----------
	'job.postJob': {
		method: 'post_job',
		kind: 'change',
		args: (c, i) => {
			const description = str(c, 'description', i);
			if (!description) throw new Error('Description is required');
			return { description, budget: toYocto(num(c, 'budget', i)) };
		},
	},
	'job.award': {
		method: 'award',
		kind: 'change',
		args: (c, i) => {
			const args: IDataObject = { job_id: jobId(c, i) };
			const winner = str(c, 'winner', i);
			if (winner) args.winner = winner; // empty = lowest bid wins
			return args;
		},
	},

	// ---------- Job board: workers ----------
	'job.bid': {
		method: 'bid',
		kind: 'change',
		args: (c, i) => ({ job_id: jobId(c, i), price: toYocto(num(c, 'price', i)) }),
	},
	'job.complete': { method: 'complete', kind: 'change', args: (c, i) => ({ job_id: jobId(c, i) }) },

	// ---------- Job board: views ----------
	'job.getJob': { method: 'get_job', kind: 'view', args: (c, i) => ({ job_id: jobId(c, i) }) },
	'job.getBids': { method: 'get_bids', kind: 'view', args: (c, i) => ({ job_id: jobId(c, i) }) },
};
