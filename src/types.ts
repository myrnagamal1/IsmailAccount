export type Category = 'IB' | 'NN' | 'Non-CRM' | 'Active';
export type Status = 'Prospect' | 'Interested' | 'Meeting Scheduled' | 'Proposal' | 'Closed Won' | 'Not Interested';

export interface Account {
  id: string;
  name: string;
  name_normalized: string;
  category: Category;
  status: Status;
  industry: string;
  partner: string;
  crm_id: string | null;
  notes: string;
  contact_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
}

export interface Activity {
  id: string;
  account_id: string;
  body: string;
  activity_type: string;
  created_at: string;
}

export interface AccountDetail extends Account {
  contacts: Contact[];
  activities: Activity[];
}
