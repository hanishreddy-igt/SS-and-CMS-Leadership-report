import axios from 'axios';

const JIRA_BASE_URL = process.env.JIRA_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    reporter?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    created: string;
    updated: string;
    duedate?: string;
    issuetype: {
      name: string;
    };
    status: {
      name: string;
    };
    description?: string;
    [key: string]: any;
  };
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

interface ImportedProject {
  name: string;
  customer: string;
  leadId: string;
  leadName: string;
  teamMemberIds: string[];
  teamMemberNames: string[];
  startDate: string;
  endDate: string;
  epicKey: string;
}

export class JiraService {
  private baseUrl: string;
  private auth: { username: string; password: string };

  constructor() {
    this.baseUrl = JIRA_BASE_URL || '';
    this.auth = {
      username: JIRA_EMAIL || '',
      password: JIRA_API_TOKEN || '',
    };

    if (!this.baseUrl || !this.auth.username || !this.auth.password) {
      throw new Error('Jira credentials not configured. Please set JIRA_URL, JIRA_EMAIL, and JIRA_API_TOKEN environment variables.');
    }
  }

  async searchIssues(jql: string, fields: string[]): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 100;

    try {
      while (true) {
        const response = await axios.get<JiraSearchResponse>(`${this.baseUrl}/rest/api/3/search`, {
          auth: this.auth,
          params: {
            jql,
            fields: fields.join(','),
            maxResults,
            startAt,
          },
        });

        const { issues, total } = response.data;
        allIssues.push(...issues);

        if (startAt + maxResults >= total) {
          break;
        }
        startAt += maxResults;
      }

      return allIssues;
    } catch (error) {
      console.error('Error searching Jira issues:', error);
      throw error;
    }
  }

  async getEpics(projectKey?: string): Promise<JiraIssue[]> {
    let jql = 'issuetype = Epic';
    if (projectKey) {
      jql += ` AND project = ${projectKey}`;
    }
    jql += ' ORDER BY created DESC';

    const fields = [
      'key',
      'summary',
      'assignee',
      'reporter',
      'created',
      'updated',
      'duedate',
      'status',
      'description',
    ];

    return this.searchIssues(jql, fields);
  }

  async getIssuesForEpic(epicKey: string): Promise<JiraIssue[]> {
    const jql = `parent = ${epicKey}`;
    const fields = ['key', 'assignee', 'reporter', 'created', 'updated'];

    return this.searchIssues(jql, fields);
  }

  async getProjectsFromJira(projectKey?: string): Promise<ImportedProject[]> {
    const epics = await this.getEpics(projectKey);
    const importedProjects: ImportedProject[] = [];

    for (const epic of epics) {
      const epicKey = epic.key;
      const epicName = epic.fields.summary;
      
      const issues = await this.getIssuesForEpic(epicKey);

      const teamMembers = new Map<string, string>();
      
      if (epic.fields.assignee) {
        teamMembers.set(
          epic.fields.assignee.accountId,
          epic.fields.assignee.displayName
        );
      }

      if (epic.fields.reporter) {
        teamMembers.set(
          epic.fields.reporter.accountId,
          epic.fields.reporter.displayName
        );
      }

      for (const issue of issues) {
        if (issue.fields.assignee) {
          teamMembers.set(
            issue.fields.assignee.accountId,
            issue.fields.assignee.displayName
          );
        }
        if (issue.fields.reporter) {
          teamMembers.set(
            issue.fields.reporter.accountId,
            issue.fields.reporter.displayName
          );
        }
      }

      const lead = epic.fields.assignee || epic.fields.reporter;
      if (!lead) {
        console.warn(`Epic ${epicKey} has no assignee or reporter, skipping`);
        continue;
      }

      const createdDate = new Date(epic.fields.created);
      const dueDate = epic.fields.duedate
        ? new Date(epic.fields.duedate)
        : new Date(createdDate.getTime() + 90 * 24 * 60 * 60 * 1000);

      const customer = this.extractCustomer(epic, projectKey);

      const teamMemberObjects = Array.from(teamMembers.entries())
        .filter(([id]) => id !== lead.accountId)
        .map(([id, name]) => ({ id, name }));

      const project: ImportedProject = {
        name: epicName,
        customer,
        leadId: lead.accountId,
        leadName: lead.displayName,
        teamMemberIds: teamMemberObjects.map((m) => m.id),
        teamMemberNames: teamMemberObjects.map((m) => m.name),
        startDate: createdDate.toISOString().split('T')[0],
        endDate: dueDate.toISOString().split('T')[0],
        epicKey,
      };

      importedProjects.push(project);
    }

    return importedProjects;
  }

  private extractCustomer(epic: JiraIssue, projectKey?: string): string {
    if (epic.fields.description) {
      const customerMatch = epic.fields.description.match(/customer[:\s]+([^\n]+)/i);
      if (customerMatch) {
        return customerMatch[1].trim();
      }
    }

    const projectName = projectKey || 'Unknown';
    return `${projectName} Project`;
  }
}
