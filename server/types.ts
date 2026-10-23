export const CATEGORIES = ['IB', 'NN', 'Non-CRM', 'Active'] as const;
export const STATUSES = ['Prospect', 'Interested', 'Meeting Scheduled', 'Proposal', 'Closed Won', 'Not Interested'] as const;

export type Category = (typeof CATEGORIES)[number];
export type AccountStatus = (typeof STATUSES)[number];

export interface ParsedContact {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
}

export interface ParsedAccount {
  name: string;
  category: Category;
  categoryDeclared: boolean;
  status: AccountStatus;
  industry: string;
  partner: string;
  crmId: string;
  notes: string;
  contacts: ParsedContact[];
}

export interface ParsedWorkbook {
  format: string;
  accounts: ParsedAccount[];
  warnings: string[];
}
