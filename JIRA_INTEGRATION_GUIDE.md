# Jira Tempo Timesheets Integration Guide

## Overview
This guide explains how to integrate Jira Tempo timesheets data into the Weekly Leadership Report Tool to automate weekly report creation using actual time tracking data.

## What You Can Automate

With Tempo timesheets integration, you can automatically pull:
- **Hours logged per project** (Epic)
- **Hours by team member**
- **Work descriptions** from worklog entries
- **Date ranges** for weekly reporting

This data can pre-populate your weekly reports instead of manually entering progress information.

---

## Integration Options

### Option 1: Tempo Cloud API (Recommended for Cloud)
**Best for:** Jira Cloud instances

**Prerequisites:**
- Tempo Timesheets for Jira Cloud
- API token from Tempo
- Jira API access for epic mapping

### Option 2: Tempo Server/Data Center API
**Best for:** Self-hosted Jira

**Prerequisites:**
- Tempo Timesheets plugin installed
- Server API access
- Authentication credentials

---

## Step-by-Step Integration

### Step 1: Get Your Tempo API Token

1. Log into your Jira instance
2. Go to **Tempo → Settings → API Integration**
3. Click **New Token**
4. Save the token securely (you'll only see it once)

### Step 2: Add API Token to Replit

You'll need to store the Tempo API token as a secret in Replit:

```bash
# In your Replit project, go to Tools → Secrets
# Add the following secrets:
TEMPO_API_TOKEN=your_tempo_token_here
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_jira_api_token
```

### Step 3: Install Required Package

Add the axios package for API calls:

```bash
npm install axios
```

### Step 4: Create Tempo API Service

Create a new file `server/services/tempoService.ts`:

```typescript
import axios from 'axios';

const TEMPO_BASE_URL = 'https://api.tempo.io/4';
const JIRA_BASE_URL = process.env.JIRA_URL;

interface TempoWorklog {
  tempoWorklogId: number;
  issue: {
    id: number;
    key?: string;
  };
  timeSpentSeconds: number;
  startDate: string;
  description: string;
  author: {
    accountId: string;
  };
}

interface WorklogSummary {
  projectName: string;
  totalHours: number;
  teamMemberHours: Record<string, number>;
  descriptions: string[];
}

export class TempoService {
  private tempoToken: string;
  private jiraAuth: { email: string; token: string };

  constructor() {
    this.tempoToken = process.env.TEMPO_API_TOKEN || '';
    this.jiraAuth = {
      email: process.env.JIRA_EMAIL || '',
      token: process.env.JIRA_API_TOKEN || '',
    };
  }

  // Get worklogs for a date range
  async getWorklogs(fromDate: string, toDate: string): Promise<TempoWorklog[]> {
    const url = `${TEMPO_BASE_URL}/worklogs`;
    const allWorklogs: TempoWorklog[] = [];
    let offset = 0;
    const limit = 1000;

    try {
      while (true) {
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${this.tempoToken}`,
          },
          params: {
            from: fromDate,
            to: toDate,
            limit,
            offset,
          },
        });

        const results = response.data.results || [];
        allWorklogs.push(...results);

        if (results.length < limit) break;
        offset += limit;
      }

      return allWorklogs;
    } catch (error) {
      console.error('Error fetching Tempo worklogs:', error);
      throw error;
    }
  }

  // Get issue details from Jira (to get epic link)
  async getIssueDetails(issueKey: string): Promise<any> {
    const url = `${JIRA_BASE_URL}/rest/api/2/issue/${issueKey}`;

    try {
      const response = await axios.get(url, {
        auth: {
          username: this.jiraAuth.email,
          password: this.jiraAuth.token,
        },
        params: {
          fields: 'customfield_10014,summary', // Epic Link field (ID may vary)
        },
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching Jira issue ${issueKey}:`, error);
      return null;
    }
  }

  // Get user display name from Jira
  async getUserDisplayName(accountId: string): Promise<string> {
    const url = `${JIRA_BASE_URL}/rest/api/2/user`;

    try {
      const response = await axios.get(url, {
        auth: {
          username: this.jiraAuth.email,
          password: this.jiraAuth.token,
        },
        params: {
          accountId,
        },
      });

      return response.data.displayName || accountId;
    } catch (error) {
      console.error(`Error fetching user ${accountId}:`, error);
      return accountId;
    }
  }

  // Group worklogs by epic and team member
  async getWeeklyReportData(
    fromDate: string,
    toDate: string
  ): Promise<Record<string, WorklogSummary>> {
    const worklogs = await this.getWorklogs(fromDate, toDate);
    const epicData: Record<string, WorklogSummary> = {};

    // Cache for issue details and user names
    const issueCache = new Map<string, any>();
    const userCache = new Map<string, string>();

    for (const worklog of worklogs) {
      // Get issue key (may need separate Jira call in v4)
      const issueKey = worklog.issue.key;
      if (!issueKey) continue;

      // Get epic link
      let issueDetails = issueCache.get(issueKey);
      if (!issueDetails) {
        issueDetails = await this.getIssueDetails(issueKey);
        if (issueDetails) {
          issueCache.set(issueKey, issueDetails);
        }
      }

      const epicKey =
        issueDetails?.fields?.customfield_10014 || 'No Epic';

      // Get user display name
      const accountId = worklog.author.accountId;
      let userName = userCache.get(accountId);
      if (!userName) {
        userName = await this.getUserDisplayName(accountId);
        userCache.set(accountId, userName);
      }

      // Initialize epic data if needed
      if (!epicData[epicKey]) {
        epicData[epicKey] = {
          projectName: epicKey,
          totalHours: 0,
          teamMemberHours: {},
          descriptions: [],
        };
      }

      // Calculate hours
      const hours = worklog.timeSpentSeconds / 3600;

      // Update totals
      epicData[epicKey].totalHours += hours;
      epicData[epicKey].teamMemberHours[userName] =
        (epicData[epicKey].teamMemberHours[userName] || 0) + hours;

      // Add description if unique
      if (
        worklog.description &&
        !epicData[epicKey].descriptions.includes(worklog.description)
      ) {
        epicData[epicKey].descriptions.push(worklog.description);
      }
    }

    return epicData;
  }

  // Format data for weekly report
  formatForWeeklyReport(
    epicData: Record<string, WorklogSummary>
  ): {
    progress: string;
    challenges: string;
    teamFeedback: string;
  } {
    const progressLines: string[] = [];
    const teamLines: string[] = [];

    for (const [epicKey, data] of Object.entries(epicData)) {
      progressLines.push(`\n${epicKey}:`);
      progressLines.push(`Total: ${data.totalHours.toFixed(1)} hours`);

      if (data.descriptions.length > 0) {
        progressLines.push('Activities:');
        data.descriptions.forEach((desc) =>
          progressLines.push(`- ${desc}`)
        );
      }

      // Team member breakdown
      teamLines.push(`\n${epicKey} team hours:`);
      for (const [member, hours] of Object.entries(
        data.teamMemberHours
      )) {
        teamLines.push(`${member}: ${hours.toFixed(1)}h`);
      }
    }

    return {
      progress: progressLines.join('\n'),
      challenges: 'Review time entries for any blockers noted',
      teamFeedback: teamLines.join('\n'),
    };
  }
}
```

### Step 5: Create API Route

Add to `server/routes.ts`:

```typescript
import { TempoService } from './services/tempoService';

// Add to your router
router.get('/api/tempo/weekly-data', async (req, res) => {
  try {
    const { fromDate, toDate, projectId } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        error: 'fromDate and toDate are required',
      });
    }

    const tempoService = new TempoService();
    const data = await tempoService.getWeeklyReportData(
      fromDate as string,
      toDate as string
    );

    const formatted = tempoService.formatForWeeklyReport(data);

    res.json({
      success: true,
      data: formatted,
      rawData: data,
    });
  } catch (error) {
    console.error('Error fetching Tempo data:', error);
    res.status(500).json({ error: 'Failed to fetch Tempo data' });
  }
});
```

### Step 6: Update Frontend to Use Tempo Data

Update `SubmitReport.tsx` to add a "Import from Tempo" button:

```typescript
// Add button to fetch Tempo data
<Button
  type="button"
  variant="outline"
  onClick={async () => {
    const weekStart = currentWeek;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const response = await fetch(
      `/api/tempo/weekly-data?fromDate=${weekStart}&toDate=${weekEnd.toISOString().split('T')[0]}&projectId=${selectedProject}`
    );
    
    const result = await response.json();
    
    if (result.success) {
      setProgress(result.data.progress);
      setChallenges(result.data.challenges);
      // Optionally pre-fill other fields
    }
  }}
>
  Import from Tempo
</Button>
```

---

## Important Notes

### Epic Link Field ID
The Epic Link custom field ID varies by Jira instance. To find yours:

1. Go to Jira → Settings → Issues → Custom Fields
2. Find "Epic Link"
3. Note the field ID (e.g., `customfield_10014`)
4. Update in the code

### Rate Limiting
- Tempo API: 1000 results per request
- Implement pagination for large datasets
- Cache user names to reduce API calls

### Testing
Test with a small date range first:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.tempo.io/4/worklogs?from=2024-01-01&to=2024-01-07&limit=10"
```

---

## Alternative: Simple CSV Export

If full API integration is complex, you can:

1. Export Tempo data as CSV
2. Upload CSV file to Replit
3. Parse CSV and pre-populate reports

---

## Troubleshooting

### Issue: "No worklogs found"
- Check date format (YYYY-MM-DD)
- Verify API token is valid
- Ensure user has permissions

### Issue: "Epic link not found"
- Verify epic link custom field ID
- Some issues may not be linked to epics

### Issue: "Authentication failed"
- Check Jira API token
- Verify email address
- Ensure tokens are stored in secrets

---

## Benefits of Integration

✅ **Automatic data collection** - No manual entry  
✅ **Accurate time tracking** - Based on actual logged hours  
✅ **Team visibility** - See who worked on what  
✅ **Historical data** - Access to past timesheet entries  
✅ **Consistency** - Standardized reporting format

---

## Next Steps

1. Set up API tokens in Replit Secrets
2. Test Tempo API connection
3. Identify your epic link field ID
4. Implement the service layer
5. Add "Import from Tempo" button to UI
6. Test with real project data

For questions or issues, refer to:
- [Tempo API Documentation](https://apidocs.tempo.io/)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v2/)
